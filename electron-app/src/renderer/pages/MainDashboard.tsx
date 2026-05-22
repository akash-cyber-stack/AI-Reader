/**
 * Main Dashboard — voice control center (dark UI, hands-free owner mode)
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import '../styles/Dashboard.css';
import '../styles/global.d.ts';
import { ThemeToggle } from '../components/ThemeToggle';
import { FeatureModal } from '../components/FeatureModal';
import { useSettings } from '../context/SettingsContext';
import { FEATURE_CATEGORIES, FeatureCategory } from '../data/featureCategories';
import { arrayBufferToBase64, blobToWav } from '../utils/audio';
import { NODE_API, PYTHON_API } from '../config/api';

interface MainDashboardProps {
  token: { token: string };
  user: { id: string; username: string; isOwner?: boolean };
  onLogout: () => void;
  onOpenSettings: () => void;
  onOpenUsers?: () => void;
}

type UIStatus = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'EXECUTING' | 'ERROR';

interface CommandState {
  requiresConfirmation: boolean;
  action?: unknown;
  voiceResponse?: string;
}

interface ServiceHealth {
  node: boolean;
  python: boolean;
}

const CONFIRM_PATTERN = /^(yes|yeah|yep|confirm|ok|okay|haan|ji|हाँ|हां)\b/i;
const CANCEL_PATTERN = /^(no|nope|cancel|abort|nahi|नहीं)\b/i;

const EXAMPLE_COMMANDS = [
  'Open Chrome',
  'Open downloads',
  'Take screenshot',
  'Lock screen',
  'Volume up',
  'Open YouTube'
];

const STATUS_LABELS: Record<UIStatus, string> = {
  IDLE: 'Ready',
  LISTENING: 'Listening',
  PROCESSING: 'Processing',
  EXECUTING: 'Executing',
  ERROR: 'Error'
};

export const MainDashboard: React.FC<MainDashboardProps> = ({
  token,
  user,
  onLogout,
  onOpenSettings,
  onOpenUsers
}) => {
  const { settings } = useSettings();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef('');
  const audioChunksRef = useRef<Blob[]>([]);
  const commandStateRef = useRef<CommandState>({ requiresConfirmation: false });
  const autoListenRef = useRef(false);
  const listenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isListeningRef = useRef(false);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const statusRef = useRef<UIStatus>('IDLE');

  const [status, setStatus] = useState<UIStatus>('IDLE');
  const [isListening, setIsListening] = useState(false);
  const [responseText, setResponseText] = useState('Initializing assistant…');
  const [commandState, setCommandState] = useState<CommandState>({
    requiresConfirmation: false
  });
  const [handsFree, setHandsFree] = useState(false);
  const [services, setServices] = useState<ServiceHealth>({ node: false, python: false });
  const [selectedFeature, setSelectedFeature] = useState<FeatureCategory | null>(null);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    const check = async () => {
      const ping = async (url: string) => {
        try {
          const c = new AbortController();
          const t = setTimeout(() => c.abort(), 3000);
          const r = await fetch(url, { signal: c.signal });
          clearTimeout(t);
          return r.ok;
        } catch {
          return false;
        }
      };
      setServices({
        node: await ping(`${NODE_API}/health`),
        python: await ping(`${PYTHON_API}/health`)
      });
    };
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, []);

  const updateCommandState = (next: CommandState) => {
    commandStateRef.current = next;
    setCommandState(next);
  };

  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (!settings.ttsEnabled) {
      onEnd?.();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = settings.ttsRate;
    utterance.pitch = 1;
    if (onEnd) {
      utterance.onend = onEnd;
      utterance.onerror = onEnd;
    }
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  }, [settings.ttsEnabled, settings.ttsRate]);

  const clearListenTimeout = () => {
    if (listenTimeoutRef.current) {
      clearTimeout(listenTimeoutRef.current);
      listenTimeoutRef.current = null;
    }
  };

  const scheduleAutoListen = useCallback((delayMs = 800) => {
    if (!mountedRef.current || !autoListenRef.current) return;
    clearListenTimeout();
    listenTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current && autoListenRef.current) {
        startListeningRef.current();
      }
    }, delayMs);
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const processCommand = useCallback(async () => {
    try {
      setStatus('PROCESSING');
      const audioBlob = new Blob(audioChunksRef.current, {
        type: mediaRecorderRef.current?.mimeType || 'audio/webm'
      });
      const commandText = transcriptRef.current.trim();

      if (!commandText) {
        setStatus('ERROR');
        setResponseText('No speech detected. Try again.');
        speak('I could not hear your command.', () => {
          setStatus('IDLE');
          setResponseText('Speak your command when the orb is active.');
          scheduleAutoListen(400);
        });
        return;
      }

      const pending = commandStateRef.current;
      if (pending.requiresConfirmation) {
        if (CONFIRM_PATTERN.test(commandText)) {
          await confirmCommandRef.current();
          return;
        }
        if (CANCEL_PATTERN.test(commandText)) {
          updateCommandState({ requiresConfirmation: false });
          setStatus('IDLE');
          setResponseText('Action cancelled.');
          speak('Cancelled.', () => scheduleAutoListen(400));
          return;
        }
        setStatus('IDLE');
        setResponseText('Say “yes” to confirm or “no” to cancel.');
        speak('Say yes to confirm, or no to cancel.', () => scheduleAutoListen(400));
        return;
      }

      const wavBlob = await blobToWav(audioBlob);
      const base64Audio = arrayBufferToBase64(await wavBlob.arrayBuffer());

      const response = await fetch(`${NODE_API}/api/commands/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.token}`
        },
        body: JSON.stringify({
          token: token.token,
          userId: user.id,
          audioBuffer: base64Audio,
          transcript: commandText
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus('ERROR');
        setResponseText(data.error || data.message || 'Access denied');
        speak(data.error || 'Access denied', () => {
          setStatus('IDLE');
          scheduleAutoListen(600);
        });
        return;
      }

      if (data.requiresConfirmation) {
        updateCommandState({
          requiresConfirmation: true,
          action: data.action,
          voiceResponse: data.voiceResponse
        });
        setStatus('IDLE');
        setResponseText('Waiting for your confirmation…');
        speak(data.voiceResponse || 'Please confirm.', () => scheduleAutoListen(500));
      } else if (data.success) {
        setStatus('EXECUTING');
        setResponseText(data.voiceResponse || 'Done.');
        speak(data.voiceResponse || 'Done.', () => {
          setStatus('IDLE');
          setResponseText('Listening for your next command…');
          scheduleAutoListen(400);
        });
      } else {
        setStatus('ERROR');
        setResponseText(data.error || 'Command failed');
        speak(data.error || 'Command failed', () => {
          setStatus('IDLE');
          scheduleAutoListen(600);
        });
      }
    } catch (err: unknown) {
      setStatus('ERROR');
      const msg = err instanceof Error ? err.message : 'Processing error';
      setResponseText(msg);
      speak('An error occurred', () => {
        setStatus('IDLE');
        scheduleAutoListen(800);
      });
    }
  }, [token.token, user.id, speak, scheduleAutoListen]);

  const confirmCommand = useCallback(async () => {
    try {
      const pending = commandStateRef.current;
      if (!pending.action) return;

      setStatus('EXECUTING');
      const response = await fetch(`${NODE_API}/api/commands/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.token}`
        },
        body: JSON.stringify({
          token: token.token,
          userId: user.id,
          action: pending.action
        })
      });

      const data = await response.json();
      if (data.success) {
        updateCommandState({ requiresConfirmation: false });
        setResponseText('Confirmed and executed.');
        speak(pending.voiceResponse || 'Done.', () => {
          setStatus('IDLE');
          scheduleAutoListen(400);
        });
      } else {
        setStatus('ERROR');
        setResponseText('Confirmation failed');
        speak('Confirmation failed', () => scheduleAutoListen(600));
      }
    } catch {
      setStatus('ERROR');
      setResponseText('Network error');
      speak('An error occurred', () => scheduleAutoListen(800));
    }
  }, [token.token, user.id, speak, scheduleAutoListen]);

  const confirmCommandRef = useRef(confirmCommand);
  confirmCommandRef.current = confirmCommand;

  const startListening = useCallback(async () => {
    if (
      !mountedRef.current ||
      isListeningRef.current ||
      statusRef.current === 'PROCESSING' ||
      statusRef.current === 'EXECUTING'
    ) {
      return;
    }

    try {
      clearListenTimeout();
      setStatus('LISTENING');
      setIsListening(true);
      isListeningRef.current = true;
      audioChunksRef.current = [];
      transcriptRef.current = '';
      setResponseText('Speak now — e.g. “Open Chrome”');

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      activeStreamRef.current = stream;
      const options = MediaRecorder.isTypeSupported('audio/webm')
        ? { mimeType: 'audio/webm' }
        : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorder.onstop = async () => {
        isListeningRef.current = false;
        setIsListening(false);
        recognitionRef.current?.stop();
        stream.getTracks().forEach((t) => t.stop());
        activeStreamRef.current = null;
        if (mountedRef.current) await processCommand();
      };

      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) {
        const recognition = new SR();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = navigator.language || 'en-US';
        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let t = '';
          for (let i = 0; i < event.results.length; i += 1) {
            t += event.results[i][0].transcript;
          }
          transcriptRef.current = t.trim();
        };
        recognitionRef.current = recognition;
        recognition.start();
      }

      mediaRecorder.start();
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') mediaRecorder.stop();
      }, settings.listenDurationSec * 1000);
    } catch {
      isListeningRef.current = false;
      setIsListening(false);
      setStatus('ERROR');
      setResponseText('Microphone access denied.');
      speak('Microphone access denied', () => scheduleAutoListen(2000));
    }
  }, [processCommand, speak, scheduleAutoListen, settings.listenDurationSec]);

  const startListeningRef = useRef(startListening);
  startListeningRef.current = startListening;

  useEffect(() => {
    mountedRef.current = true;
    const isOwner = user?.isOwner !== false;
    const hf = isOwner && settings.handsFreeMode;
    autoListenRef.current = hf;
    setHandsFree(hf);

    if (hf) {
      setResponseText('Hands-free active — speak any command.');
      speak('Assistant ready. Say what you want to do.', () => scheduleAutoListen(300));
    } else if (isOwner) {
      setResponseText('Tap Start listening or enable hands-free in Settings.');
    } else {
      setResponseText('View-only mode. Owner voice controls commands.');
    }

    return () => {
      mountedRef.current = false;
      autoListenRef.current = false;
      clearListenTimeout();
      speechSynthesis.cancel();
      stopListening();
      activeStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [user?.isOwner, settings.handsFreeMode, speak, scheduleAutoListen, stopListening]);

  const orbClass = `voice-orb-wrap status-${status.toLowerCase()}`;
  const statusTitleClass = `status-title ${status.toLowerCase()}`;
  const initial = (user.username || 'U').charAt(0).toUpperCase();

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-brand">
          <div className="dashboard-brand-icon" aria-hidden>🎤</div>
          <div>
            <h1>AI Reader</h1>
            <span>Voice desktop assistant</span>
          </div>
        </div>
        <div className="dashboard-header-actions">
          <div className="user-badge">
            <div className="user-badge-avatar">{initial}</div>
            <div className="user-badge-info">
              <strong>
                {user.username}
                {user.isOwner && <span className="owner-tag">Owner</span>}
              </strong>
              <small>Voice verified session</small>
            </div>
          </div>
          <button type="button" className="header-nav-btn" onClick={onOpenSettings} title="Settings">
            ⚙️
          </button>
          {user.isOwner && onOpenUsers && (
            <button type="button" className="header-nav-btn" onClick={onOpenUsers} title="Users">
              👥
            </button>
          )}
          <ThemeToggle />
          <button type="button" onClick={onLogout} className="logout-button">
            Logout
          </button>
        </div>
      </header>

      <FeatureModal feature={selectedFeature} onClose={() => setSelectedFeature(null)} />

      <main className="dashboard-main">
        <section className="dashboard-center">
          <div className={orbClass}>
            <div className="voice-orb-ring" />
            <div className="voice-orb-core" aria-hidden>
              {status === 'LISTENING' ? '🎙️' : status === 'PROCESSING' ? '⚙️' : status === 'ERROR' ? '⚠️' : '✨'}
            </div>
          </div>

          <div className="status-card">
            <p className="status-label">Status</p>
            <h2 className={statusTitleClass}>{STATUS_LABELS[status]}</h2>
            <p className="status-message">{responseText}</p>
          </div>

          {handsFree && (
            <div className="hands-free-banner">
              <span>🟢</span>
              <span>Hands-free mode — no button needed. Your voice unlocks every action.</span>
            </div>
          )}

          {!handsFree && (
            !isListening ? (
              <button
                type="button"
                onClick={startListening}
                disabled={status === 'EXECUTING' || status === 'PROCESSING'}
                className="listen-button"
              >
                Start listening
              </button>
            ) : (
              <button type="button" onClick={stopListening} className="listen-button listening">
                Stop listening
              </button>
            )
          )}

          {commandState.requiresConfirmation && !handsFree && (
            <div className="confirm-panel">
              <p>Confirm this action?</p>
              <div className="confirm-actions">
                <button type="button" onClick={confirmCommand} className="confirm-yes">
                  Confirm
                </button>
                <button
                  type="button"
                  className="confirm-no"
                  onClick={() => {
                    updateCommandState({ requiresConfirmation: false });
                    setStatus('IDLE');
                    setResponseText('Cancelled.');
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {commandState.requiresConfirmation && handsFree && (
            <div className="confirm-panel">
              <p>Say &quot;yes&quot; to confirm or &quot;no&quot; to cancel.</p>
            </div>
          )}
        </section>

        <aside className="dashboard-sidebar">
          {settings.showServiceStatus && (
            <div className="panel">
              <h3>Services</h3>
              <div className="service-list">
                <div className="service-item">
                  <span>Node API · 5000</span>
                  <span className={`service-dot ${services.node ? 'online' : 'offline'}`} />
                </div>
                <div className="service-item">
                  <span>Python AI · 8000</span>
                  <span className={`service-dot ${services.python ? 'online' : 'offline'}`} />
                </div>
              </div>
            </div>
          )}

          <div className="panel">
            <h3>Capabilities — tap to explore</h3>
            <div className="feature-grid">
              {FEATURE_CATEGORIES.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="feature-chip feature-chip-btn"
                  onClick={() => setSelectedFeature(f)}
                >
                  <span className="feature-chip-icon">{f.icon}</span>
                  <strong>{f.title}</strong>
                  {f.desc}
                </button>
              ))}
            </div>
          </div>

          {settings.showExampleCommands && (
            <div className="panel">
              <h3>Try saying</h3>
              <div className="command-examples">
                {EXAMPLE_COMMANDS.map((cmd) => (
                  <span key={cmd} className="command-pill">
                    {cmd}
                  </span>
                ))}
              </div>
            </div>
          )}
        </aside>
      </main>

      <footer className="dashboard-footer">
        <span>🔒 Owner voice verification</span>
        <span>🎤 Commands not shown on screen</span>
        <span>📋 Secure audit logging</span>
      </footer>
    </div>
  );
};
