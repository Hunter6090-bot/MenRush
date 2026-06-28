import React from 'react';
import { useNavigate } from 'react-router-dom';
import { goBack } from '../lib/mobileBack';

interface MobileBackButtonProps {
  fallback?: string;
  label?: string;
  className?: string;
  /** Show text label (default true on small screens via responsive classes). */
  showLabel?: boolean;
  onClick?: () => void;
}

export function MobileBackButton({
  fallback = '/discover',
  label = 'Back',
  className = '',
  showLabel = true,
  onClick,
}: MobileBackButtonProps) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={onClick ?? (() => goBack(navigate, fallback))}
      aria-label={label}
      data-testid="mobile-back"
      className={`inline-flex min-h-[44px] shrink-0 items-center gap-0.5 rounded-xl px-2 text-[#C4832A] transition-colors hover:bg-[#3D2B0E]/45 active:scale-[0.98] ${className}`}
    >
      <ChevronLeftIcon className="h-6 w-6 shrink-0" />
      {showLabel && <span className="text-sm font-bold leading-none pr-1">{label}</span>}
    </button>
  );
}

export function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}
