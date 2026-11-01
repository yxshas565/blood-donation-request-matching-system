import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { verifyAccessToken } from '../../src/middleware/auth.js';
import { createRateLimiter } from '../../src/middleware/rateLimit.js';
import { validateEnv } from '../../src/config/validateEnv.js';

const secret = 'unit-test-secret-value-that-is-more-than-32-bytes-long';

test('JWT verification accepts HS256, rejects expired tokens and disallows other algorithms', () => {
  const valid = jwt.sign({ userId: 12, role: 'Admin' }, secret, { algorithm: 'HS256', expiresIn: '2m' });
  assert.equal(verifyAccessToken(valid, secret).userId, 12);
  const expired = jwt.sign({ userId: 12 }, secret, { algorithm: 'HS256', expiresIn: '-1s' });
  assert.throws(() => verifyAccessToken(expired, secret));
  const otherAlgorithm = jwt.sign({ userId: 12 }, secret, { algorithm: 'HS384' });
  assert.throws(() => verifyAccessToken(otherAlgorithm, secret));
  assert.throws(() => verifyAccessToken(jwt.sign({ userId: 0 }, secret), secret));
});

test('mandatory environment validation rejects weak and empty credentials without exposing values', () => {
  assert.throws(() => validateEnv({ JWT_SECRET: 'short', MYSQL_HOST: 'localhost', MYSQL_USER: 'root', MYSQL_DATABASE: 'db', MYSQL_PASSWORD: '', MONGODB_URI: 'mongodb://localhost', MONGODB_DATABASE: 'db' }), /JWT_SECRET/);
  assert.equal(validateEnv({ JWT_SECRET: secret, MYSQL_HOST: 'localhost', MYSQL_USER: 'test', MYSQL_DATABASE: 'test', MYSQL_PASSWORD: 'nonempty', MONGODB_URI: 'mongodb://localhost', MONGODB_DATABASE: 'test' }), true);
});

test('rate limiter emits 429 and permits requests after its window', () => {
  let time = 1000;
  const limiter = createRateLimiter({ windowMs: 1000, max: 2, message: 'limited', now: () => time });
  const run = () => {
    const response = { statusCode: 200, headers: {}, status(code) { this.statusCode = code; return this; }, set(key, value) { this.headers[key] = value; }, json(body) { this.body = body; return this; } };
    let continued = false;
    limiter({ ip: 'test-client' }, response, () => { continued = true; });
    return { response, continued };
  };
  assert.equal(run().continued, true);
  assert.equal(run().continued, true);
  const limited = run();
  assert.equal(limited.response.statusCode, 429);
  assert.equal(limited.response.headers['Retry-After'], '1');
  time = 2001;
  assert.equal(run().continued, true);
});
