import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../hooks/store';
import { publicSignOutClass } from '../lib/publicStyles';

export const VerifySignOut: React.FC = () => {
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => {
        logout();
        navigate('/login');
      }}
      className={publicSignOutClass}
    >
      Sign out
    </button>
  );
};
