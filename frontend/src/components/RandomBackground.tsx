import { useState } from 'react';

const BACKGROUNDS = [
  '/images/menrush/01-rooftop-skyline-bears.jpeg',
  '/images/menrush/02-soho-night-crowd.jpeg',
  '/images/menrush/04-leather-harness-bears.jpeg',
  '/images/menrush/09-cigar-daddy-bar.jpeg',
  '/images/menrush/16-amsterdam-neon-night.jpeg',
  '/images/menrush/21-pride-parade-flags.jpeg',
  '/images/menrush/22-daddy-twink-bar.jpeg',
  '/images/menrush/31-london-rooftop-dusk.jpeg',
  '/images/menrush/36-wet-street-bar-line.jpeg',
  '/images/menrush/41-twink-jock-neon-street.jpeg',
];

export function RandomBackground() {
  const [current] = useState(() => Math.floor(Math.random() * BACKGROUNDS.length));

  return (
    <>
      {BACKGROUNDS.map((src, index) => (
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
