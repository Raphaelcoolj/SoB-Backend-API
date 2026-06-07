import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import passport from 'passport';
import compression from 'compression';
import morgan from 'morgan';

import apiResponse from './utils/apiResponse.js';

// Passport strategy is a side-effect-only module — imported for its side effects
import './config/passport.js';

// Routes
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import postRoutes from './routes/post.routes.js';
import commentRoutes from './routes/comment.routes.js';
import feedRoutes from './routes/feed.routes.js';
import fieldRoutes from './routes/field.routes.js';
import searchRoutes from './routes/search.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import adminRoutes from './routes/admin.routes.js';

const app = express();

// Security & Optimization
app.use(helmet());
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200,
}));

// Rate Limiters
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again after 15 minutes.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts. Please try again after 15 minutes.' },
});

app.use(globalLimiter);

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Passport
app.use(passport.initialize());

// Health check
app.get('/', (_req, res) => {
  res.status(200).json(apiResponse.success('SoB Express API is running successfully.'));
});

// Mount routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/fields', fieldRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

// Global Error Handler
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  const statusCode = err.status || 500;
  res.status(statusCode).json(
    apiResponse.error(err.message || 'Internal Server Error', process.env.NODE_ENV === 'development' ? err.stack : undefined)
  );
});

export default app;
