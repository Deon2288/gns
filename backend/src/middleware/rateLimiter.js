const rateLimit = require('express-rate-limit');

// General API rate limiter: 100 requests per minute per IP
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
});

// Stricter limiter for write/action endpoints: 20 requests per minute per IP
const actionLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
});

module.exports = { apiLimiter, actionLimiter };
