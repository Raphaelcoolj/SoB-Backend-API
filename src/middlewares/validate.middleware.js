import { validationResult } from 'express-validator';
import apiResponse from '../utils/apiResponse.js';

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
    }));
    return res.status(400).json(apiResponse.error('Validation failed', formattedErrors));
  }
  next();
};

export default validate;
