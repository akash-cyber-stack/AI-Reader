import React, { useState, useEffect, useCallback } from 'react';
import { ThemeToggle } from '../components/ThemeToggle';
import '../styles/ManageUsers.css';

const API_BASE = 'http://localhost:5000';

interface UserRow {
  id: string;
  username: string;
  email?: string;
  isOwner: boolean;
}

interface ManageUsersPageProps {
  token: string;
  onBack: () => void;
}

export const ManageUsersPage: React.FC<ManageUsersPageProps> = ({ token, onBack }) => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || data.detail || 'Failed to load');
      setUsers(data.users || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load users');
    }
  }, [token]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ username, password, email: email || undefined })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || data.detail || 'Create failed');
      }
      setSuccess(`User "${username}" created.`);
      setUsername('');
      setPassword('');
      setEmail('');
      await loadUsers();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="users-page">
      <header className="users-header">
        <button type="button" className="settings-back" onClick={onBack}>
          ← Back
        </button>
        <h1>Manage users</h1>
        <ThemeToggle />
      </header>

      <div className="users-body">
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 16 }}>
          Only you (owner) can add accounts. New users log in with the credentials you create.
        </p>

        {error && <div className="users-error">{error}</div>}
        {success && <div className="users-success">{success}</div>}

        <form className="users-form" onSubmit={handleCreate}>
          <h2>Add new user</h2>
          <div className="form-group">
            <label>Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              autoComplete="off"
            />
          </div>
          <div className="form-group">
            <label>Password (min 8)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <div className="form-group">
            <label>Email (optional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? 'Creating…' : 'Create user'}
          </button>
        </form>

        <div className="users-list">
          <h2>All users ({users.length})</h2>
          {users.map((u) => (
            <div key={u.id} className="user-card">
              <div>
                <strong>{u.username}</strong>
                {u.isOwner && <span className="owner-tag">Owner</span>}
                <small>{u.email || 'No email'}</small>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
