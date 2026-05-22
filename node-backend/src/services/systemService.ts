/**
 * System Control Service
 * Executes desktop-level actions using child_process and system APIs
 */

import { exec } from 'child_process';
import { promisify } from 'util';
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

  private expandPath(inputPath: string): string {
    const home = process.env.USERPROFILE || process.env.HOME || '';
    return inputPath
      .replace(/%USERPROFILE%/gi, home)
      .replace(/^~([\\/]|$)/, `${home}$1`)
      .replace(/^~/, home);
  }

  /**
   * Open an application by name
   */
  async openApp(appName: string, appArgs?: string[]): Promise<CommandResult> {
    try {
      const args = appArgs || [];
      const name = appName.trim();

      if (this.isWindows) {
        if (name.includes(':') && !name.includes(' ')) {
          await execAsync(`start "" "${name}"`, { shell: 'cmd.exe' });
        } else {
          const argPart = args.length ? ` ${args.map((a) => `"${a}"`).join(' ')}` : '';
          await execAsync(`start "" "${name}"${argPart}`, { shell: 'cmd.exe' });
        }
        return {
          success: true,
          output: `Opening ${name}`
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
   * Open a web URL in the default browser.
   */
  async openUrl(url: string): Promise<CommandResult> {
    try {
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Only http and https URLs are allowed');
      }

      if (this.isWindows) {
        await execAsync(`start "" "${parsedUrl.toString()}"`);
      } else if (this.isMac) {
        await execAsync(`open "${parsedUrl.toString()}"`);
      } else if (this.isLinux) {
        await execAsync(`xdg-open "${parsedUrl.toString()}"`);
      } else {
        throw new Error(`Unsupported platform: ${platform()}`);
      }

      return {
        success: true,
        output: `Opening ${parsedUrl.toString()}`
      };
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
   * Delete a file (owner: allowed under user profile)
   */
  async deleteFile(
    filePath: string,
    options?: { ownerMode?: boolean }
  ): Promise<CommandResult> {
    try {
      const resolved = this.expandPath(filePath.trim());
      if (!resolved) {
        throw new Error('File path is required');
      }

      const home = process.env.USERPROFILE || process.env.HOME || '';
      const normalized = path.resolve(resolved);
      const homeResolved = path.resolve(home);

      if (options?.ownerMode) {
        const blocked = ['windows', 'system32', 'program files'];
        const lower = normalized.toLowerCase();
        if (blocked.some((part) => lower.includes(`\\${part}\\`) || lower.includes(`/${part}/`))) {
          throw new Error('Cannot delete system files');
        }
        if (home && !normalized.toLowerCase().startsWith(homeResolved.toLowerCase())) {
          throw new Error('Owner can only delete files inside the user profile');
        }
      } else if (filePath.includes('..')) {
        throw new Error('Access denied');
      }

      await fs.unlink(normalized);
      return {
        success: true,
        output: `File deleted: ${normalized}`
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
      const resolved = this.expandPath(filePath);
      await fs.mkdir(path.dirname(resolved), { recursive: true });
      await fs.writeFile(resolved, content, 'utf-8');
      return {
        success: true,
        output: `File created: ${resolved}`
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
  async openFile(filePath: string): Promise<CommandResult> {
    try {
      const resolved = this.expandPath(filePath);
      if (this.isWindows) {
        await execAsync(`start "" "${resolved}"`, { shell: 'cmd.exe' });
      } else if (this.isMac) {
        await execAsync(`open "${resolved}"`);
      } else if (this.isLinux) {
        await execAsync(`xdg-open "${resolved}"`);
      }
      return { success: true, output: `Opening file: ${resolved}` };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async openFolder(folderPath: string): Promise<CommandResult> {
    try {
      const resolved = this.expandPath(folderPath);
      if (this.isWindows) {
        const command = `start "" "${resolved}"`;
        await execAsync(command, { shell: 'cmd.exe' });
        return {
          success: true,
          output: `Opening folder: ${resolved}`
        };
      } else if (this.isMac) {
        const command = `open "${resolved}"`;
        await execAsync(command);
        return {
          success: true,
          output: `Opening folder: ${resolved}`
        };
      } else if (this.isLinux) {
        const command = `xdg-open "${resolved}"`;
        await execAsync(command);
        return {
          success: true,
          output: `Opening folder: ${resolved}`
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
        if (volume === 0) {
          await execAsync(
            'powershell -NoProfile -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"'
          );
        } else {
          const steps = Math.max(1, Math.round(volume / 2));
          await execAsync(
            `powershell -NoProfile -Command "$s=New-Object -ComObject WScript.Shell; 1..${steps} | ForEach-Object { $s.SendKeys([char]175) }"`
          );
        }
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

      if (this.isWindows) {
        const script = [
          'Add-Type -AssemblyName System.Windows.Forms',
          'Add-Type -AssemblyName System.Drawing',
          '$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds',
          '$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height',
          '$graphics = [System.Drawing.Graphics]::FromImage($bitmap)',
          '$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)',
          `$bitmap.Save('${filePath.replace(/'/g, "''")}', [System.Drawing.Imaging.ImageFormat]::Png)`,
          '$graphics.Dispose()',
          '$bitmap.Dispose()'
        ].join('; ');
        await execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${script.replace(/"/g, '\\"')}"`);
      } else if (this.isMac) {
        await execAsync(`screencapture "${filePath}"`);
      } else if (this.isLinux) {
        await execAsync(`gnome-screenshot -f "${filePath}"`);
      } else {
        throw new Error('Unsupported platform');
      }

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

  async lockScreen(): Promise<CommandResult> {
    try {
      if (this.isWindows) {
        await execAsync('rundll32.exe user32.dll,LockWorkStation');
      } else if (this.isMac) {
        await execAsync(
          '/System/Library/CoreServices/Menu\\ Extras/User.menu/Contents/Resources/CGSession -suspend'
        );
      } else if (this.isLinux) {
        await execAsync('loginctl lock-session');
      }
      return { success: true, output: 'Screen locked' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async sleepSystem(): Promise<CommandResult> {
    try {
      if (this.isWindows) {
        await execAsync('rundll32.exe powrprof.dll,SetSuspendState 0,1,0');
      } else if (this.isMac) {
        await execAsync('pmset sleepnow');
      } else if (this.isLinux) {
        await execAsync('systemctl suspend');
      }
      return { success: true, output: 'System sleeping' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async typeText(text: string): Promise<CommandResult> {
    try {
      const escaped = text.replace(/'/g, "''").replace(/"/g, '`"');
      if (this.isWindows) {
        await execAsync(
          `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${escaped.replace(/[+^%~[\](){}]/g, '{$&}')}')"`
        );
      } else if (this.isMac) {
        await execAsync(`osascript -e 'tell application "System Events" to keystroke "${escaped}"'`);
      } else if (this.isLinux) {
        await execAsync(`xdotool type "${escaped}"`);
      }
      return { success: true, output: 'Text typed' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Run a shell command for the verified owner (blocked patterns only)
   */
  async runOwnerCommand(command: string): Promise<CommandResult> {
    return this.executeCustomCommand(command);
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
