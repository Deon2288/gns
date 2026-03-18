'use strict';

/**
 * Middleware for Role-Based Access Control (RBAC)
 * 
 * @param {Array} allowedRoles - Roles allowed to access the route
 * @returns {Function} - Express middleware function
 */
function rbac(allowedRoles) {
    return (req, res, next) => {
        const userRole = req.user.role; // Ensure req.user is populated with user information

        if (!userRole) {
            return res.status(403).json({ message: 'User role not found' });
        }

        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({ message: 'Access denied: insufficient permissions' });
        }

        next();
    };
}

module.exports = rbac;
