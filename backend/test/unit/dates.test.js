import test from 'node:test';
import assert from 'node:assert/strict';
import { dateOnly, isDateOnly, toMongoDate } from '../../src/services/dates.js';

test('dateOnly preserves a MySQL DATE string as a calendar date', () => {
  assert.equal(dateOnly('2026-10-31'), '2026-10-31');
  assert.equal(dateOnly('2024-02-29'), '2024-02-29');
});

test('dateOnly rejects malformed and impossible calendar dates', () => {
  for (const value of ['2025-02-29', '2025-13-01', '2025-1-01', 'not-a-date']) assert.throws(() => dateOnly(value));
  assert.equal(isDateOnly('2024-02-29'), true);
  assert.equal(isDateOnly('2025-02-29'), false);
});

test('BSON dates use UTC midnight and serialize to the same date-only value', () => {
  const value = toMongoDate('2025-12-20');
  assert.equal(value.toISOString(), '2025-12-20T00:00:00.000Z');
  assert.equal(dateOnly(value), '2025-12-20');
});

test('BSON instants are converted using their UTC calendar day', () => {
  assert.equal(dateOnly(new Date('2026-07-05T00:00:00.000Z')), '2026-07-05');
});
