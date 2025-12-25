/**
 * GoalKick Lite - Admin Authentication Middleware
 * Session-based authentication for admin routes
 */

/**
 * Check if user is authenticated as admin
 */
function requireAdmin(req, res, next) {
    if (req.session && req.session.adminId) {
        return next();
    }

    // Store intended destination for post-login redirect
    req.session.returnTo = req.originalUrl;
    res.redirect('/admin/login');
}

/**
 * Check if user is already logged in (for login page)
 */
function redirectIfAuthenticated(req, res, next) {
    if (req.session && req.session.adminId) {
        return res.redirect('/admin');
    }
    next();
}

/**
 * Attach admin info to response locals for views
 */
function attachAdminToLocals(req, res, next) {
    res.locals.admin = req.session.admin || null;
    res.locals.isAdmin = !!req.session.adminId;
    next();
}

module.exports = {
    requireAdmin,
    redirectIfAuthenticated,
    attachAdminToLocals
};
