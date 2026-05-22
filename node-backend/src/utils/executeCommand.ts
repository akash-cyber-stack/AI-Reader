/**
 * Central command executor — runs any action the owner voice pipeline returns.
 */

import { CommandAction } from '../services/commandService';
import { systemService } from '../services/systemService';

export async function executeCommandAction(action: CommandAction): Promise<{ output?: string; error?: string; success: boolean }> {
  const { type, parameters } = action;

  switch (type) {
    case 'OPEN_APP':
      return systemService.openApp(parameters.appName, parameters.arguments);

    case 'OPEN_URL':
      return systemService.openUrl(parameters.url);

    case 'CLOSE_APP':
      return systemService.closeApp(parameters.appName);

    case 'DELETE_FILE':
      return systemService.deleteFile(parameters.filePath, { ownerMode: true });

    case 'CREATE_FILE':
      return systemService.createFile(parameters.filePath, parameters.content ?? '');

    case 'OPEN_FOLDER':
      return systemService.openFolder(parameters.folderPath);

    case 'OPEN_FILE':
      return systemService.openFile(parameters.filePath);

    case 'SET_VOLUME':
      return systemService.setVolume(parameters.volume);

    case 'MUTE_VOLUME':
      return systemService.setVolume(0);

    case 'SCREENSHOT':
      return systemService.takeScreenshot(parameters.outputPath);

    case 'SYSTEM_SHUTDOWN':
      return systemService.systemShutdown();

    case 'SYSTEM_RESTART':
      return systemService.systemRestart();

    case 'LOCK_SCREEN':
      return systemService.lockScreen();

    case 'SLEEP_SYSTEM':
      return systemService.sleepSystem();

    case 'TYPE_TEXT':
      return systemService.typeText(parameters.text);

    case 'RUN_COMMAND':
      return systemService.runOwnerCommand(parameters.command);

    case 'CUSTOM_COMMAND':
      return systemService.runOwnerCommand(parameters.command);

    default:
      throw new Error(`Unknown command type: ${type}`);
  }
}

export function actionNeedsConfirmation(action: CommandAction, dangerousTypes: string[]): boolean {
  if (action.requiresConfirmation === true) {
    return true;
  }
  return dangerousTypes.includes(action.type);
}
