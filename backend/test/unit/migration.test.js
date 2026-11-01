import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('migrations are additive, inspect schema before ALTER and never truncate existing data', async () => {
  const files = ['001_integrations.js', '002_drop_legacy_donation_trigger.js'];
  const sources = await Promise.all(files.map(file => readFile(new URL(`../../src/migrations/${file}`, import.meta.url), 'utf8')));
  const combined = sources.join('\n');
  assert.match(combined, /information_schema\.COLUMNS/);
  assert.match(combined, /information_schema\.STATISTICS/);
  assert.match(combined, /information_schema\.TABLE_CONSTRAINTS/);
  assert.match(combined, /CREATE TABLE IF NOT EXISTS IntegrationOutbox/);
  assert.doesNotMatch(combined, /\bTRUNCATE\b|\bDROP\s+TABLE\b|DELETE\s+FROM\s+`?\w+`?/i);
});
