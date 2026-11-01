import test from 'node:test';
import assert from 'node:assert/strict';
import { deliverOutboxEvent, retryDelaySeconds } from '../../src/services/outboxDelivery.js';

function fakeDatabase() {
  const notifications = new Map();
  const histories = new Map();
  return {
    notifications, histories,
    collection(name) {
      return { async updateOne(filter, update, options = {}) {
        if (name === 'Notifications') {
          const key = filter.dedupe_key;
          if (!notifications.has(key)) notifications.set(key, update.$setOnInsert);
          return { upsertedCount: notifications.has(key) ? 1 : 0 };
        }
        const current = histories.get(Number(filter.mysql_donation_id));
        const version = update.$set.sync_event_id;
        if (!current) {
          if (!options.upsert) return { matchedCount: 0 };
          histories.set(Number(filter.mysql_donation_id), update.$set);
          return { upsertedCount: 1 };
        }
        if (Number(current.sync_event_id || 0) >= version) {
          const error = new Error('duplicate key'); error.code = 11000; throw error;
        }
        histories.set(Number(filter.mysql_donation_id), { ...current, ...update.$set });
        return { matchedCount: 1 };
      } };
    }
  };
}

test('notification delivery uses deterministic dedupe upsert keys', async () => {
  const db = fakeDatabase();
  const event = { Event_ID: 1, Event_Type: 'notification.create', Payload: { recipient_user_id: 2, title: 'T', dedupe_key: 'request:5:user:2' } };
  await deliverOutboxEvent(event, db);
  await deliverOutboxEvent(event, db);
  assert.equal(db.notifications.size, 1);
  assert.equal(db.notifications.get('request:5:user:2').recipient_user_id, 2);
});

test('failed Mongo delivery can be retried from the same durable event after recovery', async () => {
  const db = fakeDatabase();
  let available = false;
  const intermittent = {
    collection(name) {
      const collection = db.collection(name);
      return { async updateOne(...args) {
        if (!available) throw Object.assign(new Error('unavailable'), { code: 'ECONNRESET' });
        return collection.updateOne(...args);
      } };
    }
  };
  const event = { Event_ID: 4, Event_Type: 'notification.create', Payload: { recipient_user_id: 3, title: 'Retry', dedupe_key: 'retry:event:4' } };
  await assert.rejects(() => deliverOutboxEvent(event, intermittent));
  available = true;
  await deliverOutboxEvent(event, intermittent);
  assert.equal(db.notifications.size, 1);
});

test('replaying a completed event after a worker restart remains idempotent', async () => {
  const persisted = fakeDatabase();
  const event = { Event_ID: 5, Event_Type: 'notification.create', Payload: { recipient_user_id: 8, title: 'Restart', dedupe_key: 'restart:event:5' } };
  await deliverOutboxEvent(event, persisted);
  // A new delivery call has no in-memory state from the first call.
  await deliverOutboxEvent(event, persisted);
  assert.equal(persisted.notifications.size, 1);
});

test('donation synchronization writes a complete UTC BSON-date snapshot and ignores stale events', async () => {
  const db = fakeDatabase();
  const payload = { mysql_donation_id: 7, donor_id: 4, blood_group: 'AB-', donation_date: '2025-12-20', quantity: 2.5, donation_status: 'Approved', hospital_id: 9 };
  await deliverOutboxEvent({ Event_ID: 10, Event_Type: 'donation.sync', Payload: payload }, db);
  await deliverOutboxEvent({ Event_ID: 9, Event_Type: 'donation.sync', Payload: { ...payload, donation_status: 'Pending' } }, db);
  const doc = db.histories.get(7);
  assert.equal(doc.donation_status, 'Approved');
  assert.equal(doc.sync_event_id, 10);
  assert.equal(doc.receiving_hospital_id, 9);
  assert.equal(doc.donation_date.toISOString(), '2025-12-20T00:00:00.000Z');
  assert.equal(doc.blood_group, 'AB-');
  assert.equal(doc.quantity, 2.5);
});

test('unsupported outbox events fail instead of being discarded', async () => {
  await assert.rejects(() => deliverOutboxEvent({ Event_ID: 1, Event_Type: 'unknown', Payload: {} }, fakeDatabase()));
});

test('retry delay grows exponentially and caps at one hour', () => {
  assert.deepEqual([1, 2, 3, 10, 100].map(retryDelaySeconds), [2, 4, 8, 1024, 3600]);
});
