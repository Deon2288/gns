const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// User registration endpoint
router.post('/register', (req, res) => {
    const { username, password } = req.body;
    // TODO: Implement user registration logic
    res.json({ message: 'Registration endpoint' });
});

// User login endpoint
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    // TODO: Implement user login logic
    const token = jwt.sign({ userId: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
});

// Middleware for token authentication
const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization'] && req.headers['authorization'].split(' ')[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
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
