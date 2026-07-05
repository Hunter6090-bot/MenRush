import { useState } from 'react';
import { MENRUSH_BACKGROUND_IMAGES } from '../lib/menrushBackgrounds';

export function RandomBackground() {
  const [current] = useState(() => Math.floor(Math.random() * MENRUSH_BACKGROUND_IMAGES.length));

  return (
    <>
      {MENRUSH_BACKGROUND_IMAGES.map((src, index) => (
        <div
          key={src}
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-700"
          style={{
            backgroundImage: `url(${src})`,
            opacity: index === current ? 1 : 0,
            filter: 'saturate(1.05) brightness(0.95)',
          }}
        />
      ))}
    </>
  );
}
