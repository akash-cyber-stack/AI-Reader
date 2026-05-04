/**
 * Main React Application Component
 * Voice-only interface with status indicators
 */

import React, { useState, useEffect, useRef } from 'react';
import { AuthPage } from './pages/AuthPage';
import { VoiceEnrollmentPage } from './pages/VoiceEnrollmentPage';
import { MainDashboard } from './pages/MainDashboard';
import './App.css';

type PageType = 'auth' | 'enrollment' | 'dashboard';

interface AuthToken {
  token: string;
  refreshToken: string;
  expiresIn: number;
  user: any;
}

export const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageType>('auth');
  const [authToken, setAuthToken] = useState<AuthToken | null>(null);
  const [user, setUser] = useState<any>(null);

  // Check if user is already authenticated
  useEffect(() => {
    const savedToken = localStorage.getItem('authToken');
    if (savedToken) {
      try {
        const parsed = JSON.parse(savedToken);
        setAuthToken(parsed);
        setUser(parsed.user);
        
        // Check voice enrollment status
        checkVoiceEnrollment(parsed);
      } catch (error) {
        console.error('Error restoring auth:', error);
        localStorage.removeItem('authToken');
      }
    }
  }, []);

  const checkVoiceEnrollment = async (token: AuthToken) => {
    try {
      const response = await fetch('http://localhost:8000/api/voice/status', {
        headers: {
          'Authorization': `Bearer ${token.token}`
        }
      });

      const data = await response.json();
      
      if (data.enrolled) {
        setCurrentPage('dashboard');
      } else {
        setCurrentPage('enrollment');
      }
    } catch (error) {
      console.error('Error checking voice enrollment:', error);
    }
  };

  const handleLogin = (token: AuthToken) => {
    setAuthToken(token);
    setUser(token.user);
    localStorage.setItem('authToken', JSON.stringify(token));
    setCurrentPage('enrollment');
  };

  const handleEnrollmentComplete = () => {
    setCurrentPage('dashboard');
  };

  const handleLogout = () => {
    setAuthToken(null);
    setUser(null);
    localStorage.removeItem('authToken');
    setCurrentPage('auth');
  };

  return (
    <div className="app-container">
      {currentPage === 'auth' && (
        <AuthPage onLogin={handleLogin} />
      )}
      
      {currentPage === 'enrollment' && authToken && (
        <VoiceEnrollmentPage
          token={authToken}
          onComplete={handleEnrollmentComplete}
        />
      )}
      
      {currentPage === 'dashboard' && authToken && user && (
        <MainDashboard
          token={authToken}
          user={user}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
};
