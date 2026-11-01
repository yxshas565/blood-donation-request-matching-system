export function createRateLimiter({ windowMs, max, message, now = Date.now }) {
  const requests = new Map();
  return (req, res, next) => {
    const currentTime = now();
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    let entry = requests.get(key);
    if (!entry || entry.resetAt <= currentTime) {
      entry = { count: 0, resetAt: currentTime + windowMs };
      requests.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt - currentTime) / 1000))));
      return res.status(429).json({ message });
    }
    if (requests.size > 10000) {
      for (const [address, item] of requests) if (item.resetAt <= currentTime) requests.delete(address);
    }
    next();
  };
}
