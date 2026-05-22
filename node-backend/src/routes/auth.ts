/**
 * Authentication Routes
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import { asyncHandler, APIError } from '../middleware/errorHandler';

const router = Router();
const PYTHON_API_URL = `http://${process.env.PYTHON_AI_HOST || 'localhost'}:${process.env.PYTHON_AI_PORT || 8000}`;
const PYTHON_TIMEOUT_MS = 15000;

const pythonClient = axios.create({
  baseURL: PYTHON_API_URL,
  timeout: PYTHON_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' }
});

interface SignupRequest extends Request {
  body: {
    username: string;
    password: string;
    email?: string;
  };
}

interface LoginRequest extends Request {
  body: {
    username: string;
    password: string;
  };
}

/**
 * GET /api/auth/users — owner only
 */
router.get('/users', asyncHandler(async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    throw new APIError(401, 'Authorization required');
  }
  try {
    const response = await pythonClient.get('/api/auth/users', {
      headers: { Authorization: authHeader }
    });
    res.json(response.data);
  } catch (error: any) {
    if (error.response) {
      const detail = error.response.data?.detail;
      throw new APIError(error.response.status, typeof detail === 'string' ? detail : 'Failed to list users');
    }
    throw error;
  }
}));

/**
 * POST /api/auth/users — owner creates user
 */
router.post('/users', asyncHandler(async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    throw new APIError(401, 'Authorization required');
  }
  const { username, password, email } = req.body;
  if (!username || !password) {
    throw new APIError(400, 'Username and password are required');
  }
  try {
    const response = await pythonClient.post(
      '/api/auth/users',
      { username, password, email },
      { headers: { Authorization: authHeader } }
    );
    res.status(201).json(response.data);
  } catch (error: any) {
    if (error.response) {
      const detail = error.response.data?.detail;
      throw new APIError(error.response.status, typeof detail === 'string' ? detail : 'Failed to create user');
    }
    throw error;
  }
}));

/**
 * POST /api/auth/signup — first owner bootstrap only when public signup disabled
 */
router.post('/signup', asyncHandler(async (req: SignupRequest, res: Response) => {
  try {
    const { username, password, email } = req.body;

    if (!username || !password) {
      throw new APIError(400, 'Username and password are required');
    }

    if (password.length < 8) {
      throw new APIError(400, 'Password must be at least 8 characters');
    }

    // Call Python backend
    const response = await pythonClient.post('/api/auth/signup', {
      username,
      password,
      email
    });

    res.status(201).json({
      success: true,
      data: response.data
    });
  } catch (error: any) {
    if (error.code === 'ECONNABORTED' || error.code === 'ECONNREFUSED') {
      throw new APIError(503, 'AI service not running. Start Python on port 8000.');
    }
    if (error.response) {
      const detail = error.response.data?.detail;
      throw new APIError(
        error.response.status,
        typeof detail === 'string' ? detail : (error.response.data?.message || 'Signup failed')
      );
    }
    throw error;
  }
}));

/**
 * POST /api/auth/login
 * Authenticate user
 */
router.post('/login', asyncHandler(async (req: LoginRequest, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      throw new APIError(400, 'Username and password are required');
    }

    // Call Python backend
    const response = await pythonClient.post('/api/auth/login', {
      username,
      password
    });

    res.json({
      success: true,
      data: response.data
    });
  } catch (error: any) {
    if (error.code === 'ECONNABORTED' || error.code === 'ECONNREFUSED') {
      throw new APIError(503, 'AI service not running. Start Python on port 8000.');
    }
    if (error.response) {
      const detail = error.response.data?.detail;
      throw new APIError(
        error.response.status,
        typeof detail === 'string' ? detail : (error.response.data?.message || 'Login failed')
      );
    }
    throw error;
  }
}));

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new APIError(401, 'No refresh token provided');
    }

    // Call Python backend
    const response = await axios.post(
      `${PYTHON_API_URL}/api/auth/refresh`,
      {},
      {
        headers: { 'Authorization': authHeader }
      }
    );

    res.json({
      success: true,
      data: response.data
    });
  } catch (error: any) {
    if (error.response) {
      throw new APIError(error.response.status, error.response.data.detail);
    }
    throw error;
  }
}));

/**
 * POST /api/auth/verify-token
 * Verify access token
 */
router.post('/verify-token', asyncHandler(async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;

    // Call Python backend
    const response = await axios.post(
      `${PYTHON_API_URL}/api/auth/verify-token`,
      {},
      {
        headers: { 'Authorization': authHeader }
      }
    );

    res.json({
      success: true,
      data: response.data
    });
  } catch (error: any) {
    res.json({
      success: false,
      valid: false
    });
  }
}));

export default router;
