const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN } = require('../config/constants');
const User = require('../models/User');
const { AuthenticationError, ConflictError, NotFoundError } = require('../utils/errors');

const generateTokens = (user) => {
  const payload = { id: user.id, email: user.email, role: user.role };
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  const refreshToken = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
  return { accessToken, refreshToken };
};

const register = async (req, res, next) => {
  try {
    const { username, email, password, role } = req.body;
    const existing = await User.findOne({ where: { email } });
    if (existing) throw new ConflictError('Email already in use');

    const user = await User.create({ username, email, password, role });
    const { accessToken, refreshToken } = generateTokens(user);
    await user.update({ refreshToken, lastLogin: new Date() });

    res.status(201).json({ user: user.toJSON(), accessToken, refreshToken });
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) throw new AuthenticationError('Invalid credentials');
    if (!user.isActive) throw new AuthenticationError('Account disabled');

    const valid = await user.validatePassword(password);
    if (!valid) throw new AuthenticationError('Invalid credentials');

    const { accessToken, refreshToken } = generateTokens(user);
    await user.update({ refreshToken, lastLogin: new Date() });

    res.json({ user: user.toJSON(), accessToken, refreshToken });
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (user) await user.update({ refreshToken: null });
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) throw new AuthenticationError('Refresh token required');

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      throw new AuthenticationError('Invalid or expired refresh token');
    }

    const user = await User.findByPk(decoded.id);
    if (!user || user.refreshToken !== token) {
      throw new AuthenticationError('Invalid refresh token');
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);
    await user.update({ refreshToken: newRefreshToken });

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    next(err);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) throw new NotFoundError('User not found');
    res.json({ user: user.toJSON() });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, logout, refreshToken, getProfile };
