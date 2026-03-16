const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                message: 'Insufficient permissions',
                required: roles,
                current: req.user.role
            });
        }
        next();
    };
};

const ROLES = {
    ADMIN: 'admin',
    MANAGER: 'manager',
    VIEWER: 'viewer',
    DRIVER: 'driver'
};

module.exports = { requireRole, ROLES };
