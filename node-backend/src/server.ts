/**
 * Node.js Backend Server
 * System control and command execution
 */

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';

import { errorHandler, requestLogger } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import systemRoutes from './routes/system';
import commandRoutes from './routes/commands';
import loggingRoutes from './routes/logging';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const app: Express = express();
const PORT = Number(process.env.PORT || process.env.NODE_PORT || 5000);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(requestLogger);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'Node.js Backend',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'AI Assistant - Node.js Backend',
    service: 'System Control & Command Execution',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      system: '/api/system',
      commands: '/api/commands',
      logging: '/api/logging'
    }
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/commands', commandRoutes);
app.use('/api/logging', loggingRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Not found',
    path: req.path
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✓ Node.js Backend running on port ${PORT}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✓ Python AI Service: ${process.env.PYTHON_AI_HOST}:${process.env.PYTHON_AI_PORT}`);
});

export default app;
