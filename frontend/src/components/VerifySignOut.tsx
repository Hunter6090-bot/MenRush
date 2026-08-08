import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../hooks/store';
import { publicSignOutClass } from '../lib/publicStyles';
import { authAPI } from '../api/client';

export const VerifySignOut: React.FC = () => {
  const logout = useAuthStore((s) => s.logout);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => {
        void authAPI.logout(refreshToken).catch(() => undefined);
        logout();
        navigate('/login');
      }}
      className={publicSignOutClass}
    >
      Sign out
    </button>
  );
};
