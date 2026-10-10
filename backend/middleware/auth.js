import { verifyToken } from '../utils/token.js';

/*
  Verifies the `Authorization: Bearer <token>` header and
  attaches the decoded payload to `req.user`.
*/
export default function auth(req, res, next) {
  const header = req.headers.authorization || '';

  const token = header.startsWith('Bearer ')
    ? header.slice(7).trim()
    : null;

  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized. Please login again.',
    });
  }

  req.user = payload;
  next();
}
