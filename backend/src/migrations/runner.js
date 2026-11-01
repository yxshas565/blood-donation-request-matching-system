import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { mysqlPool } from '../config/mysql.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
const backupDirectory = path.resolve(directory, '../../../.backups');

async function ensureMigrationTable() {
  await mysqlPool.query(`CREATE TABLE IF NOT EXISTS SchemaMigrations (
    Migration_ID VARCHAR(120) NOT NULL PRIMARY KEY,
    Applied_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`);
}

export async function appliedMigrations() {
  await ensureMigrationTable();
  const [rows] = await mysqlPool.query('SELECT Migration_ID FROM SchemaMigrations ORDER BY Migration_ID');
  return rows.map(row => row.Migration_ID);
}

async function hasVerifiedBackup() {
  let files = [];
  try { files = (await readdir(backupDirectory)).filter(file => file.startsWith('manifest-') && file.endsWith('.json')); }
  catch { return false; }
  for (const file of files.sort().reverse()) {
    try {
      const manifest = JSON.parse(readFileSync(path.join(backupDirectory, file), 'utf8'));
      if (!manifest.verified || !manifest.mysql?.file || !manifest.mongodb?.file) continue;
      const entries = [manifest.mysql, manifest.mongodb];
      const valid = entries.every(entry => {
        const target = path.resolve(entry.file);
        if (!target.startsWith(`${backupDirectory}${path.sep}`) || !existsSync(target)) return false;
        const actual = createHash('sha256').update(readFileSync(target)).digest('hex');
        return actual.toLowerCase() === String(entry.sha256).toLowerCase();
      });
      if (valid) return true;
    } catch { /* Ignore incomplete or malformed backup manifests. */ }
  }
  return false;
}

export async function runMigrations() {
  const files = (await readdir(directory)).filter(file => /^\d+_[a-z0-9_-]+\.js$/i.test(file)).sort();
  const [historyTable] = await mysqlPool.execute(
    "SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='SchemaMigrations' AND TABLE_TYPE='BASE TABLE'"
  );
  const [historyRows] = historyTable.length
    ? await mysqlPool.query('SELECT Migration_ID FROM SchemaMigrations ORDER BY Migration_ID')
    : [[]];
  const applied = historyRows.map(row => row.Migration_ID);
  const pending = [];
  for (const file of files) {
    const migration = await import(pathToFileURL(path.join(directory, file)).href);
    if (!applied.includes(migration.id)) pending.push({ file, migration });
  }
  if (pending.length) {
    const [existingTables] = await mysqlPool.execute(
      `SELECT COUNT(*) AS Count FROM information_schema.TABLES
        WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE'
          AND TABLE_NAME IN ('User','BloodGroup','Donor','Donation','Hospital','Organization','BloodRequest','BloodInventory')`
    );
    if (Number(existingTables[0].Count) > 0 && !(await hasVerifiedBackup())) {
      throw Object.assign(new Error('A verified MySQL and MongoDB backup is required before migrating an existing database'), { code: 'BACKUP_REQUIRED' });
    }
  }
  await ensureMigrationTable();
  for (const { migration } of pending) {
    await migration.up(mysqlPool);
    await mysqlPool.execute('INSERT INTO SchemaMigrations (Migration_ID) VALUES (?)', [migration.id]);
  }
  const [result] = await mysqlPool.query('SELECT Migration_ID,Applied_At FROM SchemaMigrations ORDER BY Migration_ID');
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  import('../config/validateEnv.js').then(({ validateEnv }) => {
    validateEnv();
    return runMigrations();
  }).then(rows => {
    console.log(`Migrations applied: ${rows.length}`);
  }).catch(error => {
    console.error(`Migration failed: ${error.code || error.name || 'error'}`);
    process.exitCode = 1;
  }).finally(() => mysqlPool.end());
}
