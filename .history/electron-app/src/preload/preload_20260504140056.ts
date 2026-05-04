/**
 * Electron Preload Script
 * Securely exposes APIs to renderer process
 */

import { contextBridge, ipcRenderer } from 'electron';

interface ElectronAPI {
// @ts-ignore: Electron types are not a module, but this import is correct for Electron preload.
import { contextBridge, ipcRenderer } from 'electron';

  getAppVersion: () => Promise<string>;
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  send: (channel: string, ...args: any[]) => void;
}

const electronAPI: ElectronAPI = {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  invoke: (channel: string, ...args: any[]) => {
    return ipcRenderer.invoke(channel, ...args);
  },
  send: (channel: string, ...args: any[]) => {
    ipcRenderer.send(channel, ...args);
  }
};

contextBridge.exposeInMainWorld('electron', electronAPI);
