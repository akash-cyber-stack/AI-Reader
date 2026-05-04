/**
 * Main Dashboard Component
 * Voice-controlled interface - NO TEXT DISPLAY OF COMMANDS
 */

import React, { useState, useRef, useEffect } from 'react';
import '../styles/Dashboard.css';

interface MainDashboardProps {
  token: any;
  user: any;
  onLogout: () => void;
}

type UIStatus = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'EXECUTING' | 'ERROR';

interface CommandState {
  requiresConfirmation: boolean;
  action?: any;
  voiceResponse?: string;
}

export const MainDashboard: React.FC<MainDashboardProps> = ({
  token,
  user,
  onLogout
}) => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [status, setStatus] = useState<UIStatus>('IDLE');
  const [isListening, setIsListening] = useState(false);
  const [responseText, setResponseText] = useState('Ready to listen...');
  const [commandState, setCommandState] = useState<CommandState>({
    requiresConfirmation: false
  });
  const audioChunksRef = useRef<Blob[]>([]);

  // Text-to-speech function (no text displayed, only audio)
  const speak = (text: string) => {
    // No text displayed to user - only audio output
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    speechSynthesis.speak(utterance);
  };

  const startListening = async () => {
    try {
      setStatus('LISTENING');
      setIsListening(true);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        setIsListening(false);
        await processCommand();
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();

      // Auto-stop after 10 seconds
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, 10000);
    } catch (error: any) {
      setStatus('ERROR');
      setResponseText('Microphone error');
      speak('Microphone access denied');
    }
  };

  const stopListening = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
  };

  const processCommand = async () => {
    try {
      setStatus('PROCESSING');
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
      const audioBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));

      const response = await fetch('http://localhost:5000/api/commands/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token.token}`
        },
        body: JSON.stringify({
          token: token.token,
          userId: user.id,
          audioBuffer: base64Audio
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus('ERROR');
        setResponseText('Command rejected');
        speak(data.error || 'Access denied');
        return;
      }

      if (data.requiresConfirmation) {
        // Command requires confirmation - play response and wait for voice confirmation
        setCommandState({
          requiresConfirmation: true,
          action: data.action,
          voiceResponse: data.voiceResponse
        });
        setStatus('IDLE');
        speak(data.voiceResponse);
        setResponseText('Awaiting confirmation');
      } else if (data.success) {
        // Command executed successfully
        setStatus('EXECUTING');
        setResponseText('Command executed');
        speak(data.voiceResponse || 'Command executed');

        // Return to idle after 2 seconds
        setTimeout(() => {
          setStatus('IDLE');
          setResponseText('Ready to listen...');
        }, 2000);
      } else {
        setStatus('ERROR');
        setResponseText('Command failed');
        speak('Command could not be executed');
      }
    } catch (error: any) {
      setStatus('ERROR');
      setResponseText('Error processing command');
      speak('An error occurred');
    }
  };

  const confirmCommand = async () => {
    try {
      if (!commandState.action) {
        return;
      }

      setStatus('EXECUTING');

      const response = await fetch('http://localhost:5000/api/commands/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token.token}`
        },
        body: JSON.stringify({
          token: token.token,
          userId: user.id,
          action: commandState.action
        })
      });

      const data = await response.json();

      if (data.success) {
        setStatus('IDLE');
        setResponseText('Command executed');
        speak(commandState.voiceResponse || 'Command executed');
        setCommandState({ requiresConfirmation: false });
      } else {
        setStatus('ERROR');
        setResponseText('Confirmation failed');
        speak('Command confirmation failed');
      }
    } catch (error: any) {
      setStatus('ERROR');
      setResponseText('Error');
      speak('An error occurred');
    }
  };

  const getStatusDisplay = () => {
    switch (status) {
      case 'LISTENING':
        return '🎤 Listening...';
      case 'PROCESSING':
        return '⚙️ Processing...';
      case 'EXECUTING':
        return '✓ Executing...';
      case 'ERROR':
        return '❌ Error';
      default:
        return '✓ Ready';
    }
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>AI Assistant</h1>
        <div className="user-info">
          <p>User: {user.username}</p>
          <button onClick={onLogout} className="logout-button">
            Logout
          </button>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="status-section">
          <div className={`status-indicator ${status.toLowerCase()}`}>
            {getStatusDisplay()}
          </div>
          <p className="status-text">{responseText}</p>
        </div>

        {/* Command Control - NO TEXT DISPLAY */}
        <div className="control-section">
          {!isListening ? (
            <button
              onClick={startListening}
              disabled={status === 'EXECUTING' || status === 'PROCESSING'}
              className="listen-button"
            >
              🎤 Start Listening
            </button>
          ) : (
            <button
              onClick={stopListening}
              className="listen-button listening"
            >
              ⏹️ Stop Listening
            </button>
          )}
        </div>

        {/* Confirmation UI (if needed) */}
        {commandState.requiresConfirmation && (
          <div className="confirmation-section">
            <p>Confirm action?</p>
            <div className="confirmation-buttons">
              <button
                onClick={confirmCommand}
                className="confirm-button"
              >
                ✓ Confirm
              </button>
              <button
                onClick={() => {
                  setCommandState({ requiresConfirmation: false });
                  setStatus('IDLE');
                  setResponseText('Ready to listen...');
                }}
                className="cancel-button"
              >
                ✕ Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="dashboard-footer">
        <p>🔒 Voice-controlled and owner-verified</p>
        <p>🎤 No speech text displayed on screen</p>
        <p>🔐 All commands logged securely</p>
      </div>
    </div>
  );
};
