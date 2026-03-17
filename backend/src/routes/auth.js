const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { register, login, logout, refreshToken, getProfile } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { registerValidation, loginValidation } = require('../utils/validators');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, password]
 *             properties:
 *               username: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 6 }
 *     responses:
 *       201: { description: User created }
 *       400: { description: Validation error }
 *       409: { description: Email already in use }
 */
router.post('/register', authLimiter, registerValidation, register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 */
router.post('/login', authLimiter, loginValidation, login);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/logout', authLimiter, authenticate, logout);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 */
router.post('/refresh', authLimiter, refreshToken);

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     summary: Get current user profile
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/profile', authLimiter, authenticate, getProfile);

module.exports = router;
