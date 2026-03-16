const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const pool = require('./db');

const vpnBridgeRoutes = require('./routes/vpn-bridge');
const deviceAccessRoutes = require('./routes/device-access');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL connection pool is defined in db.js and shared across route modules

// JWT middleware
const authenticateJWT = (req, res, next) => {
    const token = req.headers['authorization'];
    if (token) {
        jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret', (err, user) => {
            if (err) {
                return res.sendStatus(403);
            }
            req.user = user;
            next();
        });
    } else {
        res.sendStatus(401);
    }
};

// Basic routes
app.post('/authenticate', (req, res) => {
    // Your authentication logic here
});

app.get('/devices', authenticateJWT, (req, res) => {
    // Logic for getting devices
});

app.post('/devices', authenticateJWT, (req, res) => {
    // Logic for adding a new device
});

// VPN Bridge & Device Access routes
app.use('/api/vpn-bridge', vpnBridgeRoutes);
app.use('/api/device-access', deviceAccessRoutes);

app.listen(3000, () => {
    console.log('Server running on port 3000');
});
