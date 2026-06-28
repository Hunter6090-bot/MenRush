import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../hooks/store';

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
      className="mt-5 block w-full text-center text-xs text-[#A89070] hover:text-[#C4832A] transition-colors"
    >
      Sign out
    </button>
  );
};
