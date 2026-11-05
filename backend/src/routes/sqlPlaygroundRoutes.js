import { Router } from 'express';
import { requireAuth, authorize } from '../middleware/auth.js';
import { playgroundPool } from '../config/mysql.js';

const router = Router();
const transactions = new Map();
const transactionTimers = new Map();
const TRANSACTION_TIMEOUT_MS = 5 * 60 * 1000;

router.use(requireAuth, authorize('Admin'));

router.post('/execute', async (req, res, next) => {
  let connection;

  try {
    const sql = typeof req.body?.sql === 'string' ? req.body.sql.trim() : '';

    if (!sql || sql.length > 10000) {
      return res.status(400).json({ message: 'Enter a SQL statement under 10,000 characters.' });
    }

    const normalizedSql = sql.replace(/;\s*$/, '').trim();
    if (!normalizedSql || normalizedSql.includes(';') || /--|\/\*|#/.test(normalizedSql)) {
      return res.status(400).json({ message: 'Execute one statement at a time without SQL comments.' });
    }

    const operation = normalizedSql.match(/^[A-Za-z]+/)?.[0]?.toUpperCase();

    const allowed = [
      'SELECT','SHOW','DESCRIBE','DESC','EXPLAIN',
      'INSERT','UPDATE','DELETE','CREATE','ALTER','DROP',
      'START','BEGIN','COMMIT','ROLLBACK','CALL'
    ];

    if (!allowed.includes(operation)) {
      return res.status(400).json({ message: 'SQL operation not permitted.' });
    }

    if (/\b(USE|GRANT|REVOKE|TRUNCATE|RENAME|LOAD|OUTFILE|DUMPFILE)\b/i.test(normalizedSql) ||
        /\b(DATABASE|SCHEMA)\s*\(/i.test(sql) ||
        /BloodDonationDB/i.test(sql)) {
      return res.status(400).json({ message: 'Access outside the playground database is restricted.' });
    }

    const userId = req.user.userId;
    const existing = transactions.get(userId);

    if (['START','BEGIN'].includes(operation)) {
      if (existing) return res.status(409).json({ message: 'A transaction is already active.' });
      connection = await playgroundPool.getConnection();
      await connection.beginTransaction();
      transactions.set(userId, connection);
      const timer = setTimeout(async () => {
        if (transactions.get(userId) !== connection) return;
        transactions.delete(userId);
        transactionTimers.delete(userId);
        try {
          await connection.rollback();
        } catch (error) {
          console.error('[SQL PLAYGROUND] Transaction timeout rollback failed:', error.message);
        } finally {
          connection.release();
        }
      }, TRANSACTION_TIMEOUT_MS);
      timer.unref?.();
      transactionTimers.set(userId, timer);
      return res.json({ success: true, message: 'Transaction started. It will automatically roll back after 5 minutes of inactivity.' });
    }

    if (['COMMIT','ROLLBACK'].includes(operation)) {
      if (!existing) return res.status(400).json({ message: 'No active transaction.' });
      try {
        if (operation === 'COMMIT') await existing.commit();
        else await existing.rollback();
      } finally {
        transactions.delete(userId);
        const timer = transactionTimers.get(userId);
        if (timer) clearTimeout(timer);
        transactionTimers.delete(userId);
        existing.release();
      }
      return res.json({ success: true, message: operation === 'COMMIT' ? 'Transaction committed successfully.' : 'Transaction rolled back successfully.' });
    }

    connection = existing || await playgroundPool.getConnection();

    try {
      const [rows, fields] = await connection.query({ sql: normalizedSql, timeout: 10000 });
      const isResultSet = Array.isArray(fields);
      const resultRows = isResultSet && Array.isArray(rows[0]) ? rows[0] : rows;
      const resultFields = isResultSet && Array.isArray(fields[0]) ? fields[0] : fields;

      res.json({
        success: true,
        operation,
        rows: isResultSet ? resultRows : [],
        columns: isResultSet ? resultFields.map(field => field.name) : [],
        affectedRows: isResultSet ? undefined : rows.affectedRows,
        insertId: isResultSet ? undefined : rows.insertId,
        message: isResultSet ? `${rows.length} row(s) returned.` : `${rows.affectedRows} row(s) affected.`
      });
    } finally {
      if (!existing) connection.release();
    }
  } catch (error) {
    if (error.code?.startsWith('ER_')) {
      return res.status(400).json({ message: error.sqlMessage || 'SQL execution failed.' });
    }
    next(error);
  }
});

export default router;
