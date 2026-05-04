/**
 * System Control Routes
 */

import { Router, Request, Response } from 'express';
import { asyncHandler, APIError } from '../middleware/errorHandler';
import { systemService } from '../services/systemService';

const router = Router();

/**
 * POST /api/system/open-app
 */
router.post('/open-app', asyncHandler(async (req: Request, res: Response) => {
  const { appName, arguments: args } = req.body;

  if (!appName) {
    throw new APIError(400, 'appName is required');
  }

  const result = await systemService.openApp(appName, args);

  res.json({
    success: result.success,
    message: result.output || result.error
  });
}));

/**
 * POST /api/system/close-app
 */
router.post('/close-app', asyncHandler(async (req: Request, res: Response) => {
  const { appName } = req.body;

  if (!appName) {
    throw new APIError(400, 'appName is required');
  }

  const result = await systemService.closeApp(appName);

  res.json({
    success: result.success,
    message: result.output || result.error
  });
}));

/**
 * POST /api/system/delete-file
 */
router.post('/delete-file', asyncHandler(async (req: Request, res: Response) => {
  const { filePath } = req.body;

  if (!filePath) {
    throw new APIError(400, 'filePath is required');
  }

  const result = await systemService.deleteFile(filePath);

  res.json({
    success: result.success,
    message: result.output || result.error
  });
}));

/**
 * POST /api/system/create-file
 */
router.post('/create-file', asyncHandler(async (req: Request, res: Response) => {
  const { filePath, content } = req.body;

  if (!filePath || content === undefined) {
    throw new APIError(400, 'filePath and content are required');
  }

  const result = await systemService.createFile(filePath, content);

  res.json({
    success: result.success,
    message: result.output || result.error
  });
}));

/**
 * POST /api/system/open-folder
 */
router.post('/open-folder', asyncHandler(async (req: Request, res: Response) => {
  const { folderPath } = req.body;

  if (!folderPath) {
    throw new APIError(400, 'folderPath is required');
  }

  const result = await systemService.openFolder(folderPath);

  res.json({
    success: result.success,
    message: result.output || result.error
  });
}));

/**
 * POST /api/system/set-volume
 */
router.post('/set-volume', asyncHandler(async (req: Request, res: Response) => {
  const { volume } = req.body;

  if (volume === undefined) {
    throw new APIError(400, 'volume is required');
  }

  const result = await systemService.setVolume(volume);

  res.json({
    success: result.success,
    message: result.output || result.error
  });
}));

/**
 * POST /api/system/screenshot
 */
router.post('/screenshot', asyncHandler(async (req: Request, res: Response) => {
  const { outputPath } = req.body;

  const result = await systemService.takeScreenshot(outputPath);

  res.json({
    success: result.success,
    message: result.output || result.error
  });
}));

/**
 * POST /api/system/shutdown
 * Dangerous - requires voice confirmation
 */
router.post('/shutdown', asyncHandler(async (req: Request, res: Response) => {
  const { confirmed } = req.body;

  if (!confirmed) {
    throw new APIError(403, 'Shutdown requires voice confirmation');
  }

  const result = await systemService.systemShutdown();

  res.json({
    success: result.success,
    message: result.output || result.error
  });
}));

/**
 * POST /api/system/restart
 * Dangerous - requires voice confirmation
 */
router.post('/restart', asyncHandler(async (req: Request, res: Response) => {
  const { confirmed } = req.body;

  if (!confirmed) {
    throw new APIError(403, 'Restart requires voice confirmation');
  }

  const result = await systemService.systemRestart();

  res.json({
    success: result.success,
    message: result.output || result.error
  });
}));

/**
 * GET /api/system/info
 */
router.get('/info', asyncHandler(async (req: Request, res: Response) => {
  const info = await systemService.getSystemInfo();

  res.json({
    success: true,
    data: info
  });
}));

export default router;
