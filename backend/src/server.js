const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const discoveryRouter = require('./routes/discovery');
const devicesRouter = require('./routes/devices');
const gpsRouter = require('./routes/gps');
const usersRouter = require('./routes/users');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
    user: 'your_user',
    host: 'localhost',
    database: 'your_database',
    password: 'your_password',
    port: 5432,
});

// JWT middleware
const authenticateJWT = (req, res, next) => {
    const token = req.headers['authorization'];
    if (token) {
        jwt.verify(token, 'your_jwt_secret', (err, user) => {
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

// Mount routers
app.use('/api', devicesRouter);
app.use('/api', gpsRouter);
app.use('/api', usersRouter);
app.use('/api/discovery', discoveryRouter);

app.listen(3000, () => {
    console.log('Server running on port 3000');
});
