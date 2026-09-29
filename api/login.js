/**
 * /api/login
 *
 * Validates admin username/password against Vercel environment variables
 * (ADMIN_USERNAME / ADMIN_PASSWORD) and, on success, sets an HTTP-only,
 * SameSite signed session cookie.
 */

const { setSessionCookie } = require('./_auth');
const crypto = require('crypto');

const safeEqual = (a, b) => {
    const ba = Buffer.from(String(a));
    const bb = Buffer.from(String(b));
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
};

module.exports = async (req, res) => {
    // Only POST
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const username = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;
    if (!username || !password) {
        res.status(500).json({ error: 'Admin credentials not configured' });
        return;
    }

    let body;
    try {
        body = typeof req.body === 'object' && req.body !== null ? req.body : JSON.parse(req.body || '{}');
    } catch (e) {
        body = {};
    }

    const uname = String(body.username || '').trim();
    const pwd = String(body.password || '').trim();

    if (!safeEqual(uname, username) || !safeEqual(pwd, password)) {
        // Generic error, never reveal which field was wrong.
        res.status(401).json({ error: 'Invalid username or password' });
        return;
    }

    setSessionCookie(res, uname);
    res.status(200).json({ ok: true });
};
