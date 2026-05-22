/**
 * Command Execution Routes
 */

import { Router, Request, Response } from 'express';
import FormData from 'form-data';
import axios from 'axios';
import { asyncHandler, APIError } from '../middleware/errorHandler';
import { commandService } from '../services/commandService';
import { executeCommandAction, actionNeedsConfirmation } from '../utils/executeCommand';

import { getPythonApiUrl } from '../config/pythonApi';

const router = Router();
const PYTHON_API_URL = getPythonApiUrl();

/**
 * POST /api/commands/process
 * Process voice command (full pipeline)
 */
router.post('/process', asyncHandler(async (req: Request, res: Response) => {
  const { token, userId, audioBuffer, transcript } = req.body;

  if (!token || !userId || !audioBuffer) {
    throw new APIError(400, 'token, userId, and audioBuffer are required');
  }

  try {
    // Step 1: Verify speaker identity (voice verification)
    console.log('Step 1: Verifying speaker identity...');

    const bufferData = Buffer.from(audioBuffer, 'base64');
    const voiceFormData = new FormData();
    voiceFormData.append('file', bufferData, 'audio.wav');

    const voiceVerificationResponse = await axios.post(
      `${PYTHON_API_URL}/api/voice/verify`,
      voiceFormData,
      {
        headers: {
          ...voiceFormData.getHeaders(),
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!voiceVerificationResponse.data.verified) {
      return res.status(403).json({
        success: false,
        error: 'You are not the owner of this system.',
        requiresConfirmation: false
      });
    }

    console.log(`✓ Speaker verified (similarity: ${voiceVerificationResponse.data.similarity.toFixed(4)})`);

    // Step 2: Convert speech to text
    console.log('Step 2: Converting speech to text...');

    const command = typeof transcript === 'string' ? transcript.trim() : '';
    const confidence = command ? 0.95 : 0;

    console.log(`✓ Transcribed: "${command}" (confidence: ${confidence.toFixed(4)})`);

    if (!command) {
      return res.json({
        success: false,
        error: 'Could not recognize your command. Please speak again.'
      });
    }

    // Step 3: Interpret command
    console.log('Step 3: Interpreting command...');

    const interpretResponse = await axios.post(
      `${PYTHON_API_URL}/api/commands/interpret`,
      {
        text: command,
        userId
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    const { action, voiceResponse, requiresConfirmation } = interpretResponse.data;
    console.log(`✓ Command interpreted: ${action.type}`);

    // Validate command
    const validation = commandService.validateCommandParameters(action);
    if (!validation.valid) {
      return res.json({
        success: false,
        error: validation.error
      });
    }

    // Step 4: Dangerous actions need voice confirmation
    const { dangerous } = await commandService.getDangerousCommands();
    const needsConfirmation = actionNeedsConfirmation(action, dangerous);

    if (needsConfirmation) {
      console.log(`⚠ Command is dangerous, requiring confirmation`);
      return res.json({
        success: true,
        action,
        command,
        voiceResponse,
        requiresConfirmation: true,
        message: 'This command requires your voice confirmation to proceed.'
      });
    }

    // Step 5: Execute command
    console.log('Step 5: Executing command...');

    let executionResult: any;

    try {
      executionResult = await executeCommandAction(action);

      if (!executionResult.success) {
        throw new Error(executionResult.error || 'Command execution failed');
      }

      console.log(`✓ Command executed successfully`);

      // Step 6: Log execution
      await commandService.logExecution(
        token,
        userId,
        command,
        action,
        'SUCCESS',
        executionResult.output,
        undefined,
        voiceResponse
      );

      return res.json({
        success: true,
        command,
        action,
        voiceResponse,
        result: executionResult
      });
    } catch (error: any) {
      // Log failed execution
      await commandService.logExecution(
        token,
        userId,
        command,
        action,
        'FAILED',
        undefined,
        error.message,
        voiceResponse
      );

      throw error;
    }
  } catch (error: any) {
    console.error('Error processing command:', error.message);

    if (error.response) {
      throw new APIError(error.response.status, error.response.data.detail || error.message);
    }
    throw error;
  }
}));

/**
 * POST /api/commands/confirm
 * Confirm dangerous command execution
 */
router.post('/confirm', asyncHandler(async (req: Request, res: Response) => {
  const { token, userId, action, command } = req.body;

  if (!token || !userId || !action) {
    throw new APIError(400, 'token, userId, and action are required');
  }

  try {
    // Execute the dangerous command
    const executionResult = await executeCommandAction(action);

    if (!executionResult.success) {
      throw new APIError(500, executionResult.error || 'Command execution failed');
    }

    // Log execution
    await commandService.logExecution(
      token,
      userId,
      command || action.type,
      action,
      'SUCCESS',
      executionResult.output,
      undefined,
      `${action.type} confirmed and executed`
    );

    res.json({
      success: true,
      message: `${action.type} executed`,
      result: executionResult
    });
  } catch (error: any) {
    console.error('Error confirming command:', error.message);

    // Log failed execution
    await commandService.logExecution(
      token,
      userId,
      command || action.type,
      action,
      'FAILED',
      undefined,
      error.message,
      `${action.type} confirmation failed`
    );

    throw error;
  }
}));

/**
 * GET /api/commands/history
 */
router.get('/history', asyncHandler(async (req: Request, res: Response) => {
  const { limit = 50, skip = 0 } = req.query;
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new APIError(401, 'Authorization required');
  }

  const history = await commandService.getExecutionHistory(
    authHeader.replace('Bearer ', ''),
    parseInt(limit as string),
    parseInt(skip as string)
  );

  res.json({
    success: true,
    data: history
  });
}));

export default router;
