import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export interface AppSettings {
  handsFreeMode: boolean;
  listenDurationSec: number;
  ttsEnabled: boolean;
  ttsRate: number;
  voiceConfirmDangerous: boolean;
  showExampleCommands: boolean;
  showServiceStatus: boolean;
  hapticFeedback: boolean;
  compactMobileLayout: boolean;
  wakePhraseEnabled: boolean;
}

const STORAGE_KEY = 'ai-reader-settings';

const DEFAULT_SETTINGS: AppSettings = {
  handsFreeMode: true,
  listenDurationSec: 10,
  ttsEnabled: true,
  ttsRate: 1,
  voiceConfirmDangerous: true,
  showExampleCommands: true,
  showServiceStatus: true,
  hapticFeedback: true,
  compactMobileLayout: true,
  wakePhraseEnabled: false
};

interface SettingsContextValue {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      }
    } catch {
      /* ignore */
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    document.documentElement.setAttribute(
      'data-compact-mobile',
      settings.compactMobileLayout ? 'true' : 'false'
    );
  }, [settings]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextValue => {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return ctx;
};

export { DEFAULT_SETTINGS };
