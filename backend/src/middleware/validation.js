const { body, validationResult } = require('express-validator');
const { handleValidationErrors } = require('../utils/validators');

const validateRequest = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map((v) => v.run(req)));
    handleValidationErrors(req, res, next);
  };
};

module.exports = { validateRequest };
