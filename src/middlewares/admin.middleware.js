import apiResponse from '../utils/apiResponse.js';

const admin = (req, res, next) => {
  if (req.user?.role === 'admin') {
    next();
  } else {
    res.status(403).json(apiResponse.error('Forbidden: Admin privileges required.'));
  }
};

export default admin;
