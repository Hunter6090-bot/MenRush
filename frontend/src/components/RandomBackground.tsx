import { useState } from 'react';
import { MENRUSH_BACKGROUND_IMAGES } from '../lib/menrushBackgrounds';

export function RandomBackground() {
  const [src] = useState(
    () => MENRUSH_BACKGROUND_IMAGES[Math.floor(Math.random() * MENRUSH_BACKGROUND_IMAGES.length)],
  );

  return (
    <div
      className="absolute inset-0 bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: `url(${src})`,
        filter: 'saturate(1.05) brightness(0.95)',
      }}
      aria-hidden
    />
  );
}
