/**
 * Command Execution Service
 * Bridges Python AI service with system control
 */

import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface CommandAction {
  type: string;
  parameters: Record<string, any>;
  requiresConfirmation?: boolean;
}

export interface ExecutionLog {
  userId: string;
  command: string;
  action: CommandAction;
  status: string;
  result?: string;
  error?: string;
  voiceResponse: string;
  timestamp: Date;
}

export class CommandExecutionService {
  private pythonApi: AxiosInstance;

  constructor() {
    const pythonUrl = `http://${process.env.PYTHON_AI_HOST || 'localhost'}:${process.env.PYTHON_AI_PORT || 8000}`;
    
    this.pythonApi = axios.create({
      baseURL: pythonUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Get list of dangerous commands that require confirmation
   */
  async getDangerousCommands(): Promise<{ dangerous: string[], safe: string[] }> {
    try {
      const response = await this.pythonApi.get('/api/commands/dangerous-commands');
      return response.data;
    } catch (error: any) {
      console.error('Error fetching dangerous commands:', error.message);
      // Default dangerous commands
      return {
        dangerous: ['DELETE_FILE', 'SYSTEM_SHUTDOWN', 'SYSTEM_RESTART'],
        safe: ['OPEN_APP', 'CLOSE_APP', 'SCREENSHOT']
      };
    }
  }

  /**
   * Check if a command is dangerous
   */
  async isCommandDangerous(commandType: string): Promise<boolean> {
    const { dangerous } = await this.getDangerousCommands();
    return dangerous.includes(commandType);
  }

  /**
   * Log command execution
   */
  async logExecution(
    token: string,
    userId: string,
    command: string,
    action: CommandAction,
    status: string,
    result?: string,
    error?: string,
    voiceResponse?: string
  ): Promise<void> {
    try {
      await this.pythonApi.post('/api/commands/log-execution', {
        userId,
        command,
        action,
        status,
        result,
        error,
        voiceResponse: voiceResponse || ''
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (error: any) {
      console.error('Error logging execution:', error.message);
      // Don't throw - logging failure shouldn't block execution
    }
  }

  /**
   * Get execution history (admin only)
   */
  async getExecutionHistory(token: string, limit: number = 50, skip: number = 0): Promise<any> {
    try {
      const response = await this.pythonApi.get(
        `/api/commands/execution-history?limit=${limit}&skip=${skip}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      return response.data;
    } catch (error: any) {
      console.error('Error fetching execution history:', error.message);
      throw error;
    }
  }

  /**
   * Interpret command using Python AI service
   */
  async interpretCommand(token: string, userId: string, text: string): Promise<any> {
    try {
      const response = await this.pythonApi.post(
        '/api/commands/interpret',
        {
          text,
          userId
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      return response.data;
    } catch (error: any) {
      console.error('Error interpreting command:', error.message);
      throw error;
    }
  }

  /**
   * Validate command execution parameters
   */
  validateCommandParameters(action: CommandAction): { valid: boolean; error?: string } {
    try {
      const { type, parameters } = action;

      switch (type) {
        case 'OPEN_APP':
          if (!parameters.appName) {
            return { valid: false, error: 'Missing appName parameter' };
          }
          break;

        case 'OPEN_URL':
          if (!parameters.url || typeof parameters.url !== 'string') {
            return { valid: false, error: 'Missing url parameter' };
          }
          break;

        case 'CLOSE_APP':
          if (!parameters.appName) {
            return { valid: false, error: 'Missing appName parameter' };
          }
          break;

        case 'DELETE_FILE':
          if (!parameters.filePath) {
            return { valid: false, error: 'Missing filePath parameter' };
          }
          break;

        case 'CREATE_FILE':
          if (!parameters.filePath || parameters.content === undefined) {
            return { valid: false, error: 'Missing filePath or content parameter' };
          }
          break;

        case 'OPEN_FOLDER':
          if (!parameters.folderPath) {
            return { valid: false, error: 'Missing folderPath parameter' };
          }
          break;

        case 'SET_VOLUME':
          if (parameters.volume === undefined || parameters.volume < 0 || parameters.volume > 100) {
            return { valid: false, error: 'Invalid volume (must be 0-100)' };
          }
          break;

        case 'SCREENSHOT':
          // No required parameters
          break;

        case 'SYSTEM_SHUTDOWN':
        case 'SYSTEM_RESTART':
          // Dangerous - should have confirmation
          break;

        default:
          return { valid: false, error: `Unknown command type: ${type}` };
      }

      return { valid: true };
    } catch (error: any) {
      return { valid: false, error: error.message };
    }
  }
}

export const commandService = new CommandExecutionService();
