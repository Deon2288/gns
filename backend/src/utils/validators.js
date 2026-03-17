const { body, param, query, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

const registerValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be 3-50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  handleValidationErrors,
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors,
];

const scanValidation = [
  body('ipRange')
    .optional()
    .matches(/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/)
    .withMessage('Invalid IP range format'),
  handleValidationErrors,
];

const snmpConfigValidation = [
  body('deviceId').isInt({ min: 1 }).withMessage('Valid device ID required'),
  body('community').optional().isString().withMessage('Community must be a string'),
  body('version')
    .optional()
    .isIn(['1', '2c', '3'])
    .withMessage('SNMP version must be 1, 2c, or 3'),
  body('port').optional().isInt({ min: 1, max: 65535 }).withMessage('Invalid port'),
  handleValidationErrors,
];

module.exports = {
  registerValidation,
  loginValidation,
  scanValidation,
  snmpConfigValidation,
  handleValidationErrors,
};
