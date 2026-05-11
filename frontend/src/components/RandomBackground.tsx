import { useState } from 'react';

const BACKGROUNDS = [
  '/bg1.png',
  '/bg2.png',
  '/bg-login.webp',
  '/bg-register.webp',
];

export function RandomBackground() {
  const [current] = useState(() => Math.floor(Math.random() * BACKGROUNDS.length));
  return (
    <div
      className="absolute inset-0 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${BACKGROUNDS[current]})` }}
    />
  );
}
