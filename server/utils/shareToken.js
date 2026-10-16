const crypto = require('crypto');

// Signed, expiring download links — so a report can be opened by someone who
// has no login (e.g. the person you sent it to on WhatsApp).
//
// A token is  <payload>.<signature>.  The payload only says WHICH report
// (type, format, date range) and WHEN the link dies. It is signed with an
// HMAC, so it cannot be edited or invented without the server secret, and the
// signature is checked BEFORE the payload is even parsed.

const SHARE_LINK_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours
const FORMATS = ['pdf', 'excel'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const signingKey = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  // Derived key: a share-link signature can never be mistaken for, or be
  // forged from, anything else the app signs with the same secret.
  return crypto.createHmac('sha256', secret).update('poultry-share-link-v1').digest();
};

const sign = (payload) => crypto.createHmac('sha256', signingKey()).update(payload).digest('base64url');

const createShareToken = ({ type, format, startDate, endDate }, { now = Date.now(), ttlMs = SHARE_LINK_TTL_MS } = {}) => {
  const expiresAt = now + ttlMs;
  const payload = Buffer.from(
    JSON.stringify({ t: type, f: format, a: startDate || null, b: endDate || null, e: expiresAt })
  ).toString('base64url');
  return { token: `${payload}.${sign(payload)}`, expiresAt: new Date(expiresAt) };
};

const MALFORMED = { ok: false, reason: 'malformed' };

const verifyShareToken = (token, { now = Date.now() } = {}) => {
  if (typeof token !== 'string' || token.length === 0 || token.length > 1000) return MALFORMED;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return MALFORMED;
  const [payload, signature] = parts;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    return { ok: false, reason: 'bad-signature' };
  }

  // From here the payload is authentic, but validate its shape anyway.
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return MALFORMED;
  }
  const dateOk = (v) => v === null || (typeof v === 'string' && DATE_RE.test(v));
  if (
    !data || typeof data !== 'object' ||
    typeof data.t !== 'string' || !FORMATS.includes(data.f) ||
    !dateOk(data.a) || !dateOk(data.b) ||
    typeof data.e !== 'number' || !Number.isFinite(data.e)
  ) {
    return MALFORMED;
  }

  if (now >= data.e) return { ok: false, reason: 'expired' };

  return { ok: true, data: { type: data.t, format: data.f, startDate: data.a, endDate: data.b, expiresAt: data.e } };
};

module.exports = { createShareToken, verifyShareToken, SHARE_LINK_TTL_MS, FORMATS };
