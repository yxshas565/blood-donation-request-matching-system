import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/authRoutes.js';
import apiRoutes from './routes/apiRoutes.js';
import sqlPlaygroundRoutes from './routes/sqlPlaygroundRoutes.js';
import { mysqlPool } from './config/mysql.js';
import { getMongoDB } from './config/mongodb.js';

const app = express();
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',').map(origin => origin.trim()).filter(Boolean);
if (process.env.NODE_ENV !== 'production') {
  for (const origin of ['http://localhost:5173', 'http://localhost:4173', 'http://127.0.0.1:4173', 'http://localhost:3000', 'http://127.0.0.1:3000']) {
    if (!allowedOrigins.includes(origin)) allowedOrigins.push(origin);
  }
}

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '1mb', strict: true }));
app.get('/', (_req, res) => res.json({ message: 'Blood Donation & Request Matching API', status: 'running' }));

app.get('/api/health', async (_req, res) => {
  let mysqlConnected = false;
  let mongoConnected = false;
  let outbox = [];
  try {
    await mysqlPool.query('SELECT 1 AS connected');
    mysqlConnected = true;
    [outbox] = await mysqlPool.query('SELECT Status,COUNT(*) AS Count FROM IntegrationOutbox GROUP BY Status');
  } catch {}
  try { await getMongoDB().command({ ping: 1 }); mongoConnected = true; } catch {}
  const healthy = mysqlConnected && mongoConnected;
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'degraded',
    application: 'Blood Donation System',
    databases: { mysql: mysqlConnected ? 'connected' : 'disconnected', mongodb: mongoConnected ? 'connected' : 'disconnected' },
    synchronization: Object.fromEntries(outbox.map(row => [row.Status.toLowerCase(), Number(row.Count)])),
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/api/sql-playground', sqlPlaygroundRoutes);
app.use((_req, res) => res.status(404).json({ message: 'API endpoint not found' }));
app.use((error, _req, res, _next) => {
  const duplicate = error.code === 'ER_DUP_ENTRY';
  const status = Number(error.status) || (duplicate ? 409 : 500);
  if (status >= 500) console.error('[API ERROR]', error.code || error.name || 'InternalError');
  const message = duplicate ? 'A record with these unique details already exists'
    : status >= 500 ? 'Internal server error' : error.message;
  res.status(status).json({ message });
});

export default app;

