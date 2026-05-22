import React from 'react';
import '../styles/MobileNav.css';

export type NavPage = 'dashboard' | 'settings' | 'users';

interface MobileNavProps {
  current: NavPage;
  isOwner: boolean;
  onNavigate: (page: NavPage) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ current, isOwner, onNavigate }) => {
  return (
    <nav className="mobile-nav" aria-label="Main navigation">
      <button
        type="button"
        className={current === 'dashboard' ? 'active' : ''}
        onClick={() => onNavigate('dashboard')}
      >
        <span aria-hidden>🎤</span>
        <span>Home</span>
      </button>
      {isOwner && (
        <button
          type="button"
          className={current === 'users' ? 'active' : ''}
          onClick={() => onNavigate('users')}
        >
          <span aria-hidden>👥</span>
          <span>Users</span>
        </button>
      )}
      <button
        type="button"
        className={current === 'settings' ? 'active' : ''}
        onClick={() => onNavigate('settings')}
      >
        <span aria-hidden>⚙️</span>
        <span>Settings</span>
      </button>
    </nav>
  );
};
