export async function enqueueOutbox(connection, { eventType, aggregateType, aggregateId, payload }) {
  const [result] = await connection.execute(
    `INSERT INTO IntegrationOutbox
      (Event_Type, Aggregate_Type, Aggregate_ID, Payload, Status, Attempt_Count, Next_Attempt_At)
     VALUES (?, ?, ?, ?, 'Pending', 0, NOW())`,
    [eventType, aggregateType, String(aggregateId), JSON.stringify(payload)]
  );
  return Number(result.insertId);
}

export async function enqueueNotification(connection, notification) {
  const { recipientUserId, recipientRole, title, message, type = 'System', relatedRequestId = null, dedupeKey } = notification;
  return enqueueOutbox(connection, {
    eventType: 'notification.create',
    aggregateType: 'notification',
    aggregateId: dedupeKey,
    payload: {
      recipient_user_id: Number(recipientUserId),
      recipient_role: recipientRole,
      related_request_id: relatedRequestId === null ? null : Number(relatedRequestId),
      title,
      message,
      notification_type: type,
      dedupe_key: dedupeKey,
      is_read: false
    }
  });
}
