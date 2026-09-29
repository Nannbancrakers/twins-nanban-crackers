/**
 * Shared authentication helpers for the Vercel serverless functions.
 *
 * Session model: an HMAC-signed token stored in an HTTP-only cookie.
 * The token embeds a username and expiry; the products API verifies the
 * signature + expiry on every write. No server-side session store needed.
 */

const crypto = require('crypto');

const SESSION_COOKIE = 'tn_admin_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

// Lazily read the secret (Vercel env var) so functions don't fail if unset
// until they actually try to use auth.
function getAuthSecret() {
    const secret = process.env.AUTH_SECRET || process.env.ADMIN_SESSION_SECRET;
    if (!secret) throw new Error('AUTH_SECRET environment variable is not set');
    return secret;
}

// base64url helpers (Browser-safe / URL-safe)
const b64urlEncode = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlDecode = (str) => Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

function hmac(data) {
    return crypto.createHmac('sha256', getAuthSecret()).update(data).digest();
}

/**
 * Create a signed session token for a username.
 * Payload: base64url({username, exp}) . base64url(hmac(payload))
 */
function createToken(username) {
    const exp = Date.now() + SESSION_TTL_MS;
    const payload = b64urlEncode(Buffer.from(JSON.stringify({ u: username, exp })));
    const sig = b64urlEncode(hmac(payload));
    return `${payload}.${sig}`;
}

/**
 * Verify a signed token. Returns the payload object or null if invalid/expired.
 */
function verifyToken(token) {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payload, sig] = parts;
    try {
        const expected = b64urlEncode(hmac(payload));
        const a = Buffer.from(sig, 'utf8');
        const b = Buffer.from(expected, 'utf8');
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
        const data = JSON.parse(b64urlDecode(payload).toString('utf8'));
        if (!data || !data.exp || Date.now() > data.exp) return null;
        return data;
    } catch (e) {
        return null;
    }
}

/** Read the auth cookie from a request. */
function getTokenFromRequest(req) {
    const header = req.headers.cookie || '';
    const match = header.match(new RegExp('(?:^|;\\s*)' + SESSION_COOKIE + '=([^;]+)'));
    return match ? decodeURIComponent(match[1]) : null;
}

/** Authenticated username from request, or null. */
function getAuthUser(req) {
    const token = getTokenFromRequest(req);
    const payload = verifyToken(token);
    return payload ? payload.u : null;
}

/** Set the session cookie on a response. */
function setSessionCookie(res, username) {
    const token = createToken(username);
    const cookie = `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`;
    res.setHeader('Set-Cookie', cookie);
}

/** Clear the session cookie. */
function clearSessionCookie(res) {
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

module.exports = {
    SESSION_COOKIE,
    getAuthUser,
    setSessionCookie,
    clearSessionCookie,
    createToken,
    verifyToken
};
