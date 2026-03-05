import React from 'react';

interface LocationPinProps {
  /** Show the animated radar rings (current user) */
  radar?: boolean;
  color?: string;
  size?: number;
  className?: string;
}

export const LocationPin: React.FC<LocationPinProps> = ({
  radar = false,
  color = '#4F8CFF',
  size = 14,
  className = '',
}) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: size * 3, height: size * 3 }}>
      {radar && (
        <>
          <span
            className="absolute inset-0 rounded-full radar-ring-1"
            style={{ backgroundColor: color, opacity: 0.5 }}
          />
          <span
            className="absolute inset-0 rounded-full radar-ring-2"
            style={{ backgroundColor: color, opacity: 0.35 }}
          />
          <span
            className="absolute inset-0 rounded-full radar-ring-3"
            style={{ backgroundColor: color, opacity: 0.2 }}
          />
        </>
      )}
      <span
        className="relative z-10 rounded-full border-2 border-white/80 shadow-lg"
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          boxShadow: `0 0 16px ${color}60`,
        }}
      />
    </div>
  );
};
