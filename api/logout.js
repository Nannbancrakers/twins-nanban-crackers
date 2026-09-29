/**
 * /api/logout
 *
 * Clears the admin session cookie.
 */

const { clearSessionCookie } = require('./_auth');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    clearSessionCookie(res);
    res.status(200).json({ ok: true });
};
