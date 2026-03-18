const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

if (!process.env.JWT_SECRET) {
    console.warn('WARNING: JWT_SECRET env var is not set. Using insecure default – set JWT_SECRET in production.');
}
const JWT_SECRET = process.env.JWT_SECRET || 'changeme_jwt_secret';

// User registration endpoint
router.post('/register', (_req, res) => {
    // TODO: Implement user registration (hash password, save to DB)
    res.status(501).json({ error: 'User registration is not yet implemented' });
});

// User login endpoint
router.post('/login', (_req, res) => {
    // TODO: Implement credential verification against DB
    res.status(501).json({ error: 'User login is not yet implemented' });
});

// Middleware for token authentication
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Protected route example
router.get('/profile', authenticateToken, (req, res) => {
    res.json({ message: 'This is a protected route', user: req.user });
});

module.exports = router;