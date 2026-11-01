import { mysqlPool } from '../config/mysql.js';
import { getMongoDB } from '../config/mongodb.js';
import { deliverOutboxEvent, retryDelaySeconds } from './outboxDelivery.js';

const MAX_ATTEMPTS = 10;
const LEASE_SECONDS = 60;
let workerTimer;
let workerRunning = false;

async function claim(eventId) {
  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();
    const sql = eventId
      ? `SELECT * FROM IntegrationOutbox WHERE Event_ID=? AND
         ((Status='Pending' AND Next_Attempt_At<=NOW()) OR (Status='Processing' AND Locked_Until<NOW()))
         FOR UPDATE SKIP LOCKED`
      : `SELECT * FROM IntegrationOutbox WHERE
         ((Status='Pending' AND Next_Attempt_At<=NOW()) OR (Status='Processing' AND Locked_Until<NOW()))
         ORDER BY Event_ID LIMIT 1 FOR UPDATE SKIP LOCKED`;
    const [rows] = await connection.execute(sql, eventId ? [eventId] : []);
    const event = rows[0];
    if (!event) { await connection.commit(); return null; }
    await connection.execute(
      `UPDATE IntegrationOutbox SET Status='Processing',Attempt_Count=Attempt_Count+1,
       Locked_Until=DATE_ADD(NOW(),INTERVAL ? SECOND) WHERE Event_ID=?`,
      [LEASE_SECONDS, event.Event_ID]
    );
    await connection.commit();
    return { ...event, Attempt_Count: Number(event.Attempt_Count) + 1 };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function finish(event, error = null) {
  const connection = await mysqlPool.getConnection();
  try {
    if (!error) {
      await connection.execute(
        `UPDATE IntegrationOutbox SET Status='Processed',Processed_At=NOW(),Locked_Until=NULL,Last_Error=NULL
         WHERE Event_ID=? AND Status='Processing'`,
        [event.Event_ID]
      );
      return;
    }
    const attempts = Number(event.Attempt_Count);
    const status = attempts >= MAX_ATTEMPTS ? 'Failed' : 'Pending';
    const delaySeconds = retryDelaySeconds(attempts);
    const safeCode = typeof error.code === 'string' || typeof error.code === 'number' ? String(error.code).slice(0, 60) : error.name || 'Error';
    await connection.execute(
      `UPDATE IntegrationOutbox SET Status=?,Locked_Until=NULL,Next_Attempt_At=DATE_ADD(NOW(),INTERVAL ? SECOND),
       Last_Error=? WHERE Event_ID=? AND Status='Processing'`,
      [status, delaySeconds, `Integration delivery failed (${safeCode})`, event.Event_ID]
    );
  } finally {
    connection.release();
  }
}

export async function processOutboxOne(eventId) {
  const event = await claim(eventId);
  if (!event) return null;
  try {
    await deliverOutboxEvent(event, getMongoDB());
    await finish(event);
    return { eventId: Number(event.Event_ID), status: 'Processed' };
  } catch (error) {
    await finish(event, error);
    return { eventId: Number(event.Event_ID), status: Number(event.Attempt_Count) >= MAX_ATTEMPTS ? 'Failed' : 'Pending' };
  }
}

export async function processOutboxBatch(limit = 25) {
  if (workerRunning) return 0;
  workerRunning = true;
  let processed = 0;
  try {
    for (let i = 0; i < limit; i += 1) {
      const result = await processOutboxOne();
      if (!result) break;
      processed += 1;
    }
  } finally {
    workerRunning = false;
  }
  return processed;
}

export function startOutboxWorker(intervalMs = 1500) {
  if (workerTimer) return;
  workerTimer = setInterval(() => {
    processOutboxBatch().catch(() => {});
  }, intervalMs);
  workerTimer.unref?.();
  processOutboxBatch().catch(() => {});
}

export function stopOutboxWorker() {
  if (workerTimer) clearInterval(workerTimer);
  workerTimer = undefined;
}

export async function getOutboxStatus({ limit = 50 } = {}) {
  const [counts] = await mysqlPool.query('SELECT Status,COUNT(*) AS Count FROM IntegrationOutbox GROUP BY Status');
  const [events] = await mysqlPool.execute(
    `SELECT Event_ID,Event_Type,Aggregate_Type,Aggregate_ID,Status,Attempt_Count,Next_Attempt_At,
            Last_Error,Created_At,Processed_At
       FROM IntegrationOutbox ORDER BY Event_ID DESC LIMIT ?`,
    [Math.min(Math.max(Number(limit) || 50, 1), 200)]
  );
  return { counts: Object.fromEntries(counts.map(row => [row.Status, Number(row.Count)])), events };
}

export async function retryOutboxEvent(eventId) {
  const [result] = await mysqlPool.execute(
    `UPDATE IntegrationOutbox SET Status='Pending',Attempt_Count=0,Next_Attempt_At=NOW(),Locked_Until=NULL,Last_Error=NULL
     WHERE Event_ID=? AND Status='Failed'`,
    [eventId]
  );
  return result.affectedRows === 1;
}
