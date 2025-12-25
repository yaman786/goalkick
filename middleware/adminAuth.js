/**
 * Check if user is authenticated as admin (Full Access)
 */
function requireAdmin(req, res, next) {
    if (req.session && req.session.adminId) {
        // If role assumption is implemented, check here. 
        // For now, assume if logged in as adminId and no specific restriction, it's ok?
        // Wait, we need to check the role stored in session.
        if (req.session.admin && req.session.admin.role === 'admin') {
            return next();
        } else if (req.session.admin) {
            // Logged in but not admin (must be staff)
            return res.status(403).render('error', {
                title: 'Access Denied',
                message: 'You do not have permission to access this area.',
                errorCode: 403
            });
        }
    }

    // Store intended destination for post-login redirect
    req.session.returnTo = req.originalUrl;
    res.redirect('/admin/login');
}

/**
 * Check if user is authenticated as Gatekeeper or Admin (Scanner Access)
 */
function requireGatekeeper(req, res, next) {
    if (req.session && req.session.adminId) {
        // Both admin and staff can access gatekeeper
        return next();
    }

    req.session.returnTo = req.originalUrl;
    res.redirect('/admin/login');
}

/**
 * Check if user is already logged in (for login page)
 */
function redirectIfAuthenticated(req, res, next) {
    if (req.session && req.session.adminId) {
        // Redirect based on role
        if (req.session.admin && req.session.admin.role === 'staff') {
            return res.redirect('/gatekeeper');
        }
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
    res.locals.isStaff = req.session.admin && req.session.admin.role === 'staff';
    res.locals.isSuperAdmin = req.session.admin && req.session.admin.role === 'admin';
    next();
}

module.exports = {
    requireAdmin,
    requireGatekeeper,
    redirectIfAuthenticated,
    attachAdminToLocals
};
