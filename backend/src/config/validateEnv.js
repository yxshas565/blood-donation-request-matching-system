export function validateEnv(env = process.env) {
  const missing = [];
  if (!env.JWT_SECRET || Buffer.byteLength(env.JWT_SECRET) < 32 || /replace-with|change-me|example/i.test(env.JWT_SECRET)) missing.push('JWT_SECRET (32+ non-placeholder characters)');
  if (!env.MYSQL_HOST || !env.MYSQL_USER || !env.MYSQL_DATABASE || !env.MYSQL_PASSWORD) missing.push('MYSQL_HOST, MYSQL_USER, MYSQL_DATABASE, MYSQL_PASSWORD');
  if (!env.MONGODB_URI || !env.MONGODB_DATABASE) missing.push('MONGODB_URI, MONGODB_DATABASE');
  if (missing.length) throw new Error(`Missing or invalid required configuration: ${missing.join('; ')}`);
  return true;
}
