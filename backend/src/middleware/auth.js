const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');
const { AuthenticationError, AuthorizationError } = require('../utils/errors');

const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AuthenticationError('No token provided'));
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AuthenticationError('Token expired'));
    }
    return next(new AuthenticationError('Invalid token'));
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AuthenticationError('Not authenticated'));
    }
    if (roles.length && !roles.includes(req.user.role)) {
      return next(new AuthorizationError('Insufficient permissions'));
    }
    next();
  };
};

module.exports = { authenticate, authorize };
