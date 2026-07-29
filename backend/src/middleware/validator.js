import { validationResult } from 'express-validator';
import AppError from '../utils/appError.js';

export const validate = (validations) => {
  return async (req, res, next) => {
    // Run all validations
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const extractedErrors = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg
    }));

    return res.status(400).json({
      status: 'fail',
      message: 'Validation failed',
      errors: extractedErrors
    });
  };
};
