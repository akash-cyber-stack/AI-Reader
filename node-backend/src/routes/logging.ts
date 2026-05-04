/**
 * Logging Routes
 * For system logging and debugging (hidden from UI)
 */

import { Router, Request, Response } from 'express';
import { asyncHandler, APIError } from '../middleware/errorHandler';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

const LOG_DIR = path.join(process.cwd(), 'logs');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * GET /api/logging/logs
 * Get system logs (requires admin access)
 */
router.get('/logs', asyncHandler(async (req: Request, res: Response) => {
  const { type = 'all', lines = 100 } = req.query;

  try {
    // This endpoint should require admin authentication
    // For now, we'll implement basic access
    
    const logFile = path.join(LOG_DIR, 'app.log');

    if (!fs.existsSync(logFile)) {
      return res.json({
        success: true,
        logs: [],
        message: 'No logs found'
      });
    }

    const logContent = fs.readFileSync(logFile, 'utf-8');
    const logLines = logContent.split('\n').slice(-parseInt(lines as string));

    res.json({
      success: true,
      logs: logLines,
      totalLines: logLines.length
    });
  } catch (error: any) {
    throw new APIError(500, `Error reading logs: ${error.message}`);
  }
}));

/**
 * POST /api/logging/clear
 * Clear logs (requires admin access)
 */
router.post('/clear', asyncHandler(async (req: Request, res: Response) => {
  try {
    const logFile = path.join(LOG_DIR, 'app.log');

    if (fs.existsSync(logFile)) {
      fs.writeFileSync(logFile, '');
    }

    res.json({
      success: true,
      message: 'Logs cleared'
    });
  } catch (error: any) {
    throw new APIError(500, `Error clearing logs: ${error.message}`);
  }
}));

/**
 * POST /api/logging/write
 * Write to log file
 */
router.post('/write', asyncHandler(async (req: Request, res: Response) => {
  const { message, level = 'INFO' } = req.body;

  if (!message) {
    throw new APIError(400, 'Message is required');
  }

  try {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message}\n`;
    const logFile = path.join(LOG_DIR, 'app.log');

    fs.appendFileSync(logFile, logEntry);

    res.json({
      success: true,
      message: 'Log entry written'
    });
  } catch (error: any) {
    throw new APIError(500, `Error writing log: ${error.message}`);
  }
}));

/**
 * GET /api/logging/stats
 * Get logging statistics
 */
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  try {
    const logFile = path.join(LOG_DIR, 'app.log');

    if (!fs.existsSync(logFile)) {
      return res.json({
        success: true,
        stats: {
          logFileExists: false,
          totalLines: 0,
          fileSize: 0
        }
      });
    }

    const stats = fs.statSync(logFile);
    const content = fs.readFileSync(logFile, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    // Count log levels
    const levels = {
      INFO: 0,
      ERROR: 0,
      WARNING: 0,
      DEBUG: 0
    };

    lines.forEach(line => {
      if (line.includes('[INFO]')) levels.INFO++;
      if (line.includes('[ERROR]')) levels.ERROR++;
      if (line.includes('[WARNING]')) levels.WARNING++;
      if (line.includes('[DEBUG]')) levels.DEBUG++;
    });

    res.json({
      success: true,
      stats: {
        logFileExists: true,
        totalLines: lines.length,
        fileSize: stats.size,
        levels,
        lastModified: stats.mtime
      }
    });
  } catch (error: any) {
    throw new APIError(500, `Error getting stats: ${error.message}`);
  }
}));

export default router;
