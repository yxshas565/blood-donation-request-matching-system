import 'dotenv/config';
import app from './app.js';
import { validateEnv } from './config/validateEnv.js';
import { testMySQL, mysqlPool } from './config/mysql.js';
import { connectMongoDB, closeMongoDB, isMongoDBConnected } from './config/mongodb.js';
import { startOutboxWorker, stopOutboxWorker } from './services/outboxWorker.js';

const PORT = Number(process.env.PORT || 5000);

async function startServer() {
  let server;
  try {
    validateEnv();
    const mysqlInfo = await testMySQL();
    if (String(mysqlInfo.db_name).toLowerCase() !== String(process.env.MYSQL_DATABASE).toLowerCase()) throw new Error('Configured MySQL database does not match the connected database');
    try { await connectMongoDB(); }
    catch (error) { console.error('[MONGODB]', error.code || error.name || 'Unavailable; reconnecting'); }
    const [migrations] = await mysqlPool.execute(
      "SELECT Migration_ID FROM SchemaMigrations WHERE Migration_ID='001_integrations'"
    );
    if (!migrations.length) throw new Error('Required database migrations are missing; run npm run migrate');
    startOutboxWorker();
    const mongoReconnect = setInterval(() => {
      if (!isMongoDBConnected()) connectMongoDB().catch(() => {});
    }, 5000);
    mongoReconnect.unref?.();
    server = app.listen(PORT, process.env.HOST || '127.0.0.1', () => {
      console.log(`Backend listening on port ${PORT}`);
    });
    const shutdown = () => {
      stopOutboxWorker();
      clearInterval(mongoReconnect);
      server.close(async () => {
        await Promise.allSettled([mysqlPool.end(), closeMongoDB()]);
      });
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  } catch (error) {
    console.error('[STARTUP ERROR]', error.code || error.name || 'ConfigurationError');
    stopOutboxWorker();
    await Promise.allSettled([mysqlPool.end(), closeMongoDB()]);
    process.exitCode = 1;
  }
}

startServer();
