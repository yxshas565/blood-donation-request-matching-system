import 'dotenv/config';
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { once } from 'node:events';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { validateEnv } from '../config/validateEnv.js';

const require = createRequire(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../package.json'));
const { MongoClient } = require('mongodb');
const { EJSON } = require('bson');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');
const outputDirectory = path.join(root, '.backups');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

function sha256(file) {
  return crypto.createHash('sha256').update(readFileSync(file)).digest('hex');
}

async function mysqlBackup() {
  const file = path.join(outputDirectory, `mysql-${process.env.MYSQL_DATABASE}-${timestamp}.sql`);
  const args = [
    `--host=${process.env.MYSQL_HOST}`, `--port=${process.env.MYSQL_PORT || 3306}`,
    `--user=${process.env.MYSQL_USER}`, '--single-transaction', '--routines',
    '--triggers', '--events', '--hex-blob', '--databases', process.env.MYSQL_DATABASE
  ];
  const child = spawn(process.env.MYSQLDUMP_PATH || 'mysqldump', args, {
    env: { ...process.env, MYSQL_PWD: process.env.MYSQL_PASSWORD },
    stdio: ['ignore', 'pipe', 'ignore']
  });
  const status = once(child, 'close');
  const output = pipeline(child.stdout, createWriteStream(file, { flags: 'wx' }));
  const [[code]] = await Promise.all([status, output]);
  if (code !== 0) throw new Error('MySQL backup command failed');
  const contents = readFileSync(file, 'utf8');
  const tables = (contents.match(/CREATE TABLE `[^`]+`/g) || []).length;
  const routines = (contents.match(/CREATE\s+(?:DEFINER=`[^`]+`@`[^`]+`\s+)?(?:PROCEDURE|FUNCTION)\s+/gi) || []).length;
  if (tables < 8 || !contents.includes('Dump completed')) throw new Error('MySQL backup validation failed');
  return { file, tables, routines, bytes: Buffer.byteLength(contents), sha256: sha256(file) };
}

async function mongoBackup() {
  const file = path.join(outputDirectory, `mongo-${process.env.MONGODB_DATABASE}-${timestamp}.ejson`);
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const database = client.db(process.env.MONGODB_DATABASE);
    const collections = [];
    for (const { name } of await database.listCollections({}, { nameOnly: true }).toArray()) {
      const collection = database.collection(name);
      collections.push({ name, indexes: await collection.indexes(), documents: await collection.find({}).toArray() });
    }
    const body = EJSON.stringify({ format: 'Extended JSON v2', database: database.databaseName, createdAt: new Date().toISOString(), collections }, { relaxed: false, space: 2 });
    writeFileSync(file, body, { flag: 'wx' });
    const parsed = EJSON.parse(readFileSync(file, 'utf8'));
    if (parsed.collections.length !== collections.length || parsed.collections.some((item, index) => item.documents.length !== collections[index].documents.length || item.indexes.length !== collections[index].indexes.length)) {
      throw new Error('MongoDB backup validation failed');
    }
    return { file, collections: collections.map(item => ({ name: item.name, documents: item.documents.length, indexes: item.indexes.length })), bytes: Buffer.byteLength(body), sha256: sha256(file) };
  } finally { await client.close().catch(() => {}); }
}

async function main() {
  validateEnv();
  mkdirSync(outputDirectory, { recursive: true });
  const mysql = await mysqlBackup();
  const mongodb = await mongoBackup();
  const manifest = { createdAt: new Date().toISOString(), verified: true, mysql, mongodb };
  const manifestPath = path.join(outputDirectory, `manifest-${timestamp}.json`);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ manifest: manifestPath, mysql: { tables: mysql.tables, routines: mysql.routines, sha256: mysql.sha256 }, mongodb: { collections: mongodb.collections, sha256: mongodb.sha256 } }));
}

main().catch(error => {
  console.error(`Backup failed: ${error.code || error.name || 'Error'}`);
  process.exitCode = 1;
});
