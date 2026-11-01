const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function dateOnly(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new TypeError('Invalid date');
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'string' && DATE_ONLY.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      throw new TypeError('Invalid date');
    }
    return value;
  }
  throw new TypeError('Date must be a valid YYYY-MM-DD value or BSON date');
}

export function toMongoDate(value) {
  return new Date(`${dateOnly(value)}T00:00:00.000Z`);
}

export function isDateOnly(value) {
  try { dateOnly(value); return true; } catch { return false; }
}
