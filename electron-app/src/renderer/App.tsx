/**
 * Main React Application
 */

import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { SettingsProvider } from './context/SettingsContext';
import { AuthPage } from './pages/AuthPage';
import { VoiceEnrollmentPage } from './pages/VoiceEnrollmentPage';
import { MainDashboard } from './pages/MainDashboard';
import { SettingsPage } from './pages/SettingsPage';
import { ManageUsersPage } from './pages/ManageUsersPage';
import { MobileNav, NavPage } from './components/MobileNav';
import './App.css';

type PageType = 'auth' | 'enrollment' | 'dashboard' | 'settings' | 'users';

interface AuthToken {
  token: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    username: string;
    isOwner?: boolean;
    email?: string;
  };
}

export const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageType>('auth');
  const [authToken, setAuthToken] = useState<AuthToken | null>(null);
  const [user, setUser] = useState<AuthToken['user'] | null>(null);

  const routeAfterAuth = (token: AuthToken, enrolled: boolean) => {
    if (!token.user?.isOwner) {
      setCurrentPage('dashboard');
      return;
    }
    setCurrentPage(enrolled ? 'dashboard' : 'enrollment');
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('authToken');
    if (!savedToken) return;

    try {
      const parsed: AuthToken = JSON.parse(savedToken);
      setAuthToken(parsed);
      setUser(parsed.user);

      fetch('http://localhost:8000/api/voice/status', {
        headers: { Authorization: `Bearer ${parsed.token}` }
      })
        .then((r) => r.json())
        .then((data) => routeAfterAuth(parsed, Boolean(data.enrolled)))
        .catch(() => setCurrentPage(parsed.user?.isOwner ? 'enrollment' : 'dashboard'));
    } catch {
      localStorage.removeItem('authToken');
    }
  }, []);

  const handleLogin = (token: AuthToken) => {
    setAuthToken(token);
    setUser(token.user);
    localStorage.setItem('authToken', JSON.stringify(token));

    fetch('http://localhost:8000/api/voice/status', {
      headers: { Authorization: `Bearer ${token.token}` }
    })
      .then((r) => r.json())
      .then((data) => routeAfterAuth(token, Boolean(data.enrolled)))
      .catch(() => setCurrentPage(token.user?.isOwner ? 'enrollment' : 'dashboard'));
  };

  const handleEnrollmentComplete = () => setCurrentPage('dashboard');

  const handleLogout = () => {
    setAuthToken(null);
    setUser(null);
    localStorage.removeItem('authToken');
    setCurrentPage('auth');
  };

  const showMobileNav =
    authToken &&
    user &&
    (currentPage === 'dashboard' || currentPage === 'settings' || currentPage === 'users');

  const navPage: NavPage =
    currentPage === 'settings' || currentPage === 'users' ? currentPage : 'dashboard';

  return (
    <ThemeProvider>
      <SettingsProvider>
        <div className="app-container">
          {currentPage === 'auth' && <AuthPage onLogin={handleLogin} />}

          {currentPage === 'enrollment' && authToken && (
            <VoiceEnrollmentPage token={authToken} onComplete={handleEnrollmentComplete} />
          )}

          {currentPage === 'dashboard' && authToken && user && (
            <MainDashboard
              token={authToken}
              user={user}
              onLogout={handleLogout}
              onOpenSettings={() => setCurrentPage('settings')}
              onOpenUsers={user.isOwner ? () => setCurrentPage('users') : undefined}
            />
          )}

          {currentPage === 'settings' && (
            <SettingsPage onBack={() => setCurrentPage('dashboard')} />
          )}

          {currentPage === 'users' && authToken && user?.isOwner && (
            <ManageUsersPage
              token={authToken.token}
              onBack={() => setCurrentPage('dashboard')}
            />
          )}

          {showMobileNav && (
            <MobileNav
              current={navPage}
              isOwner={Boolean(user?.isOwner)}
              onNavigate={(p) => setCurrentPage(p)}
            />
          )}
        </div>
      </SettingsProvider>
    </ThemeProvider>
  );
};
