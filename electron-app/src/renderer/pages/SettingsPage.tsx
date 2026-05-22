import React, { useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import { ThemeToggle } from '../components/ThemeToggle';
import '../styles/Settings.css';

interface SettingsPageProps {
  onBack: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onBack }) => {
  const { settings, updateSettings, resetSettings } = useSettings();
  const [savedFlash, setSavedFlash] = useState(false);

  const patch = (p: Partial<typeof settings>) => {
    updateSettings(p);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  return (
    <div className="settings-page">
      <header className="settings-header">
        <button type="button" className="settings-back" onClick={onBack}>
          ← Back
        </button>
        <h1>Settings</h1>
        <ThemeToggle />
      </header>

      <div className="settings-body">
        <div className="settings-group">
          <h2>Voice assistant</h2>
          <div className="setting-row">
            <label>
              <strong>Hands-free mode</strong>
              <small>Auto-listen after each command (owner)</small>
            </label>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.handsFreeMode}
                onChange={(e) => patch({ handsFreeMode: e.target.checked })}
              />
              <span className="setting-slider" />
            </label>
          </div>
          <div className="setting-row">
            <label>
              <strong>Listen duration</strong>
              <small>{settings.listenDurationSec} seconds per command</small>
              <input
                type="range"
                className="setting-range"
                min={5}
                max={15}
                step={1}
                value={settings.listenDurationSec}
                onChange={(e) => patch({ listenDurationSec: Number(e.target.value) })}
              />
            </label>
          </div>
          <div className="setting-row">
            <label>
              <strong>Voice responses (TTS)</strong>
              <small>Speak confirmations aloud</small>
            </label>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.ttsEnabled}
                onChange={(e) => patch({ ttsEnabled: e.target.checked })}
              />
              <span className="setting-slider" />
            </label>
          </div>
          <div className="setting-row">
            <label>
              <strong>Confirm dangerous actions</strong>
              <small>Require “yes” for delete / shutdown</small>
            </label>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.voiceConfirmDangerous}
                onChange={(e) => patch({ voiceConfirmDangerous: e.target.checked })}
              />
              <span className="setting-slider" />
            </label>
          </div>
        </div>

        <div className="settings-group">
          <h2>Display</h2>
          <div className="setting-row">
            <label>
              <strong>Example commands</strong>
              <small>Show “Try saying” pills on dashboard</small>
            </label>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.showExampleCommands}
                onChange={(e) => patch({ showExampleCommands: e.target.checked })}
              />
              <span className="setting-slider" />
            </label>
          </div>
          <div className="setting-row">
            <label>
              <strong>Service status</strong>
              <small>Show Node / Python health dots</small>
            </label>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.showServiceStatus}
                onChange={(e) => patch({ showServiceStatus: e.target.checked })}
              />
              <span className="setting-slider" />
            </label>
          </div>
          <div className="setting-row">
            <label>
              <strong>Compact mobile layout</strong>
              <small>Optimized for phones and small screens</small>
            </label>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.compactMobileLayout}
                onChange={(e) => patch({ compactMobileLayout: e.target.checked })}
              />
              <span className="setting-slider" />
            </label>
          </div>
        </div>

        <div className="settings-group">
          <h2>Advanced</h2>
          <div className="setting-row">
            <label>
              <strong>Haptic feedback</strong>
              <small>Vibration on mobile when available</small>
            </label>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.hapticFeedback}
                onChange={(e) => patch({ hapticFeedback: e.target.checked })}
              />
              <span className="setting-slider" />
            </label>
          </div>
          <div className="setting-row">
            <label>
              <strong>Wake phrase (beta)</strong>
              <small>Future: listen for “Hey Reader”</small>
            </label>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.wakePhraseEnabled}
                onChange={(e) => patch({ wakePhraseEnabled: e.target.checked })}
              />
              <span className="setting-slider" />
            </label>
          </div>
        </div>

        <button type="button" className="reset-settings-btn" onClick={resetSettings}>
          Reset all settings to default
        </button>
        <p className="settings-saved">{savedFlash ? '✓ Settings saved' : ''}</p>
      </div>
    </div>
  );
};
