import crypto from 'crypto';

/*
  Dependency-free token + password helpers.
  Uses Node's built-in `crypto` (HMAC-SHA256 signed token + scrypt password hash)
  so no extra npm packages are required.
*/

const SECRET =
  process.env.JWT_SECRET || 'medical-store-dev-secret-change-me';

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fromBase64url(str) {
  return Buffer.from(
    str.replace(/-/g, '+').replace(/_/g, '/'),
    'base64'
  ).toString();
}

function hmac(data) {
  return crypto
    .createHmac('sha256', SECRET)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function signToken(payload, expiresInSec = TOKEN_TTL_SECONDS) {
  const body = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + expiresInSec,
  };

  const data = base64url(JSON.stringify(body));
  const signature = hmac(data);

  return `${data}.${signature}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return null;
  }

  const [data, signature] = token.split('.');

  const expected = hmac(data);

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const body = JSON.parse(fromBase64url(data));

    if (body.exp && body.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return body;
  } catch {
    return null;
  }
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) {
    return false;
  }

  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(password, salt, 64).toString('hex');

  const a = Buffer.from(hash);
  const b = Buffer.from(test);

  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
