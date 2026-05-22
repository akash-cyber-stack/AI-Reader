/**
 * Authentication Page Component
 * Login/Signup interface
 */

import React, { useState, useEffect } from 'react';
import { ThemeToggle } from '../components/ThemeToggle';
import '../styles/Auth.css';
// @ts-ignore: Importing CSS module types
import '../styles/global.d.ts';
import { NODE_API } from '../config/api';

const API_BASE = NODE_API;
const REQUEST_TIMEOUT_MS = 20000;

interface AuthPageProps {
  onLogin: (token: any) => void;
}

type AuthMode = 'login' | 'signup';

interface AuthPayload {
  token: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    username: string;
    email?: string;
    isOwner: boolean;
  };
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    const detail = body.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
    return body.error || body.message || `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

export const AuthPage: React.FC<AuthPageProps> = ({ onLogin }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [backendStatus, setBackendStatus] = useState<'checking' | 'ok' | 'down'>('checking');

  useEffect(() => {
    const checkBackend = async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(`${API_BASE}/health`, { signal: controller.signal });
        setBackendStatus(res.ok ? 'ok' : 'down');
      } catch {
        setBackendStatus('down');
      } finally {
        clearTimeout(timer);
      }
    };
    checkBackend();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      if (backendStatus === 'down') {
        throw new Error(
          'Backend is not running. Start Node (port 5000) and Python (port 8000), then try again.'
        );
      }

      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/signup';
      const payload = mode === 'login'
        ? { username, password }
        : { username, password, email: email || undefined };

      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      const body = await response.json();
      const auth: AuthPayload = body.data ?? body;

      if (!auth?.token || !auth?.user) {
        throw new Error('Invalid response from server. Please try again.');
      }

      onLogin(auth);
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          setError('Request timed out. Check that Python and Node servers are running.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-top-bar">
        <ThemeToggle />
      </div>
      <div className="auth-card">
        <h1>🎤 AI Reader</h1>
        <p className="subtitle">Voice-controlled desktop assistant</p>

        {backendStatus === 'down' && (
          <div className="error-message backend-warn">
            Servers offline. Run: <code>scripts\start-all.ps1</code>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
              disabled={loading}
            />
          </div>

          {mode === 'signup' && (
            <div className="form-group">
              <label>Email (Optional)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email"
                disabled={loading}
              />
            </div>
          )}

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password (min 8 characters)"
              required
              minLength={8}
              disabled={loading}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            type="submit"
            disabled={loading || backendStatus === 'down'}
            className="submit-button"
          >
            {loading ? 'Please wait...' : (mode === 'login' ? 'Login' : 'Sign Up')}
          </button>
        </form>

        <div className="mode-toggle">
          {mode === 'login' ? (
            <p>
              New here? Only the <strong>first account</strong> can register as owner, or ask
              your owner to add you in <strong>Users</strong> after they log in.
              <button
                type="button"
                className="toggle-button"
                style={{ display: 'block', marginTop: 8 }}
                onClick={() => {
                  setMode('signup');
                  setError('');
                }}
                disabled={loading}
              >
                Create first owner account
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className="toggle-button"
                disabled={loading}
              >
                Login
              </button>
            </p>
          )}
        </div>

        <div className="security-info">
          <p>✓ Owner adds all other users</p>
          <p>✓ Voice authentication for commands</p>
          <p>✓ Works on desktop &amp; mobile browser</p>
        </div>
      </div>
    </div>
  );
};
