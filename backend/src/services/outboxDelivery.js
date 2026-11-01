import { toMongoDate } from './dates.js';

function payloadOf(event) {
  return typeof event.Payload === 'string' ? JSON.parse(event.Payload) : event.Payload;
}

export async function deliverOutboxEvent(event, database) {
  const payload = payloadOf(event);
  if (event.Event_Type === 'notification.create') {
    await database.collection('Notifications').updateOne(
      { dedupe_key: payload.dedupe_key },
      { $setOnInsert: { ...payload, created_at: new Date() } },
      { upsert: true }
    );
    return;
  }
  if (event.Event_Type === 'donation.sync') {
    const id = Number(payload.mysql_donation_id);
    const version = Number(event.Event_ID);
    const { hospital_id: hospitalId, ...source } = payload;
    const snapshot = {
      ...source,
      receiving_hospital_id: hospitalId,
      donation_date: toMongoDate(payload.donation_date)
    };
    try {
      await database.collection('DonationHistory').updateOne(
        { mysql_donation_id: id, $or: [{ sync_event_id: { $lt: version } }, { sync_event_id: { $exists: false } }] },
        { $set: { ...snapshot, sync_event_id: version } },
        { upsert: true }
      );
    } catch (error) {
      if (error.code === 11000) return;
      throw error;
    }
    return;
  }
  throw new Error('Unsupported outbox event type');
}

export function retryDelaySeconds(attempt) {
  return Math.min(3600, 2 ** Math.min(Math.max(1, Number(attempt) || 1), 12));
}
