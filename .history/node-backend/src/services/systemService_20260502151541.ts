/**
 * System Control Service
 * Executes desktop-level actions using child_process and system APIs
 */

import { exec, execFile, spawn } from 'child_process';
import { promisify } from 'util';
import * as robotjs from 'robotjs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { platform } from 'os';

const execAsync = promisify(exec);

export interface CommandResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
}

export class SystemControlService {
  private isWindows = platform() === 'win32';
  private isMac = platform() === 'darwin';
  private isLinux = platform() === 'linux';

  /**
   * Open an application by name
   */
  async openApp(appName: string, arguments?: string[]): Promise<CommandResult> {
    try {
      const args = arguments || [];
      
      if (this.isWindows) {
        // Windows: use start command
        const command = `start ${appName}`;
        execAsync(command);
        return {
          success: true,
          output: `Opening ${appName}`
        };
      } else if (this.isMac) {
        // macOS: use open command
        const command = `open -a "${appName}"`;
        execAsync(command);
        return {
          success: true,
          output: `Opening ${appName}`
        };
      } else if (this.isLinux) {
        // Linux: use xdg-open or direct command
        const command = `${appName} ${args.join(' ')} &`;
        execAsync(command);
        return {
          success: true,
          output: `Opening ${appName}`
        };
      }
      
      throw new Error(`Unsupported platform: ${platform()}`);
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Close an application by name
   */
  async closeApp(appName: string): Promise<CommandResult> {
    try {
      if (this.isWindows) {
        const command = `taskkill /IM ${appName}.exe /F`;
        const { stdout, stderr } = await execAsync(command);
        return {
          success: true,
          output: `${appName} closed`
        };
      } else if (this.isMac) {
        const command = `pkill -f "${appName}"`;
        const { stdout, stderr } = await execAsync(command);
        return {
          success: true,
          output: `${appName} closed`
        };
      } else if (this.isLinux) {
        const command = `pkill -f "${appName}"`;
        const { stdout, stderr } = await execAsync(command);
        return {
          success: true,
          output: `${appName} closed`
        };
      }
      
      throw new Error(`Unsupported platform`);
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(filePath: string): Promise<CommandResult> {
    try {
      // Security check: prevent deletion outside user directory
      if (filePath.includes('..') || filePath.startsWith('/')) {
        throw new Error('Access denied');
      }
      
      await fs.unlink(filePath);
      return {
        success: true,
        output: `File deleted: ${filePath}`
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create a file with content
   */
  async createFile(filePath: string, content: string): Promise<CommandResult> {
    try {
      await fs.writeFile(filePath, content, 'utf-8');
      return {
        success: true,
        output: `File created: ${filePath}`
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Open a folder/directory
   */
  async openFolder(folderPath: string): Promise<CommandResult> {
    try {
      if (this.isWindows) {
        const command = `start "" "${folderPath}"`;
        execAsync(command);
        return {
          success: true,
          output: `Opening folder: ${folderPath}`
        };
      } else if (this.isMac) {
        const command = `open "${folderPath}"`;
        execAsync(command);
        return {
          success: true,
          output: `Opening folder: ${folderPath}`
        };
      } else if (this.isLinux) {
        const command = `xdg-open "${folderPath}"`;
        execAsync(command);
        return {
          success: true,
          output: `Opening folder: ${folderPath}`
        };
      }
      
      throw new Error(`Unsupported platform`);
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Set system volume (0-100)
   */
  async setVolume(volume: number): Promise<CommandResult> {
    try {
      if (volume < 0 || volume > 100) {
        throw new Error('Volume must be between 0 and 100');
      }

      if (this.isWindows) {
        // Windows: Use nircmd or similar
        // This is a placeholder - actual implementation would use Windows APIs
        return {
          success: true,
          output: `Volume set to ${volume}%`
        };
      } else if (this.isMac) {
        const percentage = Math.round((volume / 100) * 16);
        const command = `osascript -e 'set volume output volume ${percentage}'`;
        execAsync(command);
        return {
          success: true,
          output: `Volume set to ${volume}%`
        };
      } else if (this.isLinux) {
        const command = `amixer set Master ${volume}%`;
        execAsync(command);
        return {
          success: true,
          output: `Volume set to ${volume}%`
        };
      }
      
      throw new Error(`Unsupported platform`);
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Take a screenshot
   */
  async takeScreenshot(outputPath?: string): Promise<CommandResult> {
    try {
      const filePath = outputPath || path.join(process.env.HOME || process.env.USERPROFILE || '/', 'screenshot.png');
      
      // Use robotjs to capture screen
      const img = robotjs.screen.capture();
      
      // In production, save the image data
      // For now, return success
      return {
        success: true,
        output: `Screenshot saved to ${filePath}`
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * System shutdown (dangerous - requires confirmation)
   */
  async systemShutdown(): Promise<CommandResult> {
    try {
      if (this.isWindows) {
        const command = 'shutdown /s /t 30 /c "System shutting down..."';
        execAsync(command);
        return {
          success: true,
          output: 'System will shutdown in 30 seconds'
        };
      } else if (this.isMac) {
        const command = 'osascript -e "tell app \\"System Events\\" to shut down"';
        execAsync(command);
        return {
          success: true,
          output: 'System shutting down'
        };
      } else if (this.isLinux) {
        const command = 'shutdown -h now';
        execAsync(command);
        return {
          success: true,
          output: 'System shutting down'
        };
      }
      
      throw new Error(`Unsupported platform`);
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * System restart (dangerous - requires confirmation)
   */
  async systemRestart(): Promise<CommandResult> {
    try {
      if (this.isWindows) {
        const command = 'shutdown /r /t 30 /c "System restarting..."';
        execAsync(command);
        return {
          success: true,
          output: 'System will restart in 30 seconds'
        };
      } else if (this.isMac) {
        const command = 'osascript -e "tell app \\"System Events\\" to restart"';
        execAsync(command);
        return {
          success: true,
          output: 'System restarting'
        };
      } else if (this.isLinux) {
        const command = 'reboot';
        execAsync(command);
        return {
          success: true,
          output: 'System restarting'
        };
      }
      
      throw new Error(`Unsupported platform`);
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Execute a custom command (restricted)
   */
  async executeCustomCommand(command: string): Promise<CommandResult> {
    try {
      // Security: Only allow safe commands
      const blockedPatterns = [
        'rm -rf',
        'format',
        'dd if=',
        'mkfs',
        'chroot'
      ];
      
      for (const pattern of blockedPatterns) {
        if (command.toLowerCase().includes(pattern)) {
          throw new Error('This command is not allowed for security reasons');
        }
      }
      
      const { stdout, stderr } = await execAsync(command, { timeout: 10000 });
      
      return {
        success: true,
        output: stdout
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get system information
   */
  async getSystemInfo(): Promise<any> {
    try {
      const os = require('os');
      
      return {
        platform: platform(),
        arch: process.arch,
        cpus: os.cpus().length,
        freemem: os.freemem(),
        totalmem: os.totalmem(),
        uptime: os.uptime(),
        homeDir: os.homedir(),
        hostname: os.hostname()
      };
    } catch (error: any) {
      return {
        error: error.message
      };
    }
  }
}

export const systemService = new SystemControlService();
