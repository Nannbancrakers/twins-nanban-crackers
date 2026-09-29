/**
 * /api/me
 *
 * Returns whether the current request has a valid admin session.
 * Used by admin.html on load to decide between the login screen and dashboard.
 */

const { getAuthUser } = require('./_auth');

module.exports = async (req, res) => {
    const user = getAuthUser(req);
    if (!user) {
        res.status(401).json({ authenticated: false });
        return;
    }
    res.status(200).json({ authenticated: true, username: user });
};
