// dotenv must be the FIRST import in ESM — it sets up process.env for all other modules
import 'dotenv/config';
import http from 'http';
import app from './src/app.js';
import connectDB from './src/config/db.js';
import { initSocket } from './src/socket/socket.js';
import { validateEnv } from './src/config/envValidator.js';

// Validate Environment
validateEnv();

// Connect to Database
connectDB();

const PORT = process.env.PORT || 5000;

// Create HTTP server wrapping Express app
const server = http.createServer(app);

// Bind Socket.io to the HTTP server
try {
  initSocket(server);
  console.log('Socket.io server initialized');
} catch (error) {
  console.log('Socket.io initialization error:', error.message);
}

// Start Server
server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Graceful Shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed.');
    import('mongoose').then((m) => {
      m.default.connection.close(false).then(() => {
        console.log('MongoDB connection closed.');
        process.exit(0);
      });
    });
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
