import React, { useState } from 'react';
import { aiAPI } from '../api/client';

interface GeneratedImage {
  imageBase64: string;
  mimeType: string;
}

interface ImageGeneratorProps {
  /** Called when the user clicks "Use as profile photo" on a generated image */
  onSelectImage?: (dataUrl: string) => void;
}

export const ImageGenerator: React.FC<ImageGeneratorProps> = ({ onSelectImage }) => {
  const [prompt, setPrompt] = useState('');
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setImages([]);
    try {
      const res = await aiAPI.generateImage(prompt.trim(), 2);
      setImages(res.data.images);
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Image generation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toDataUrl = (img: GeneratedImage) =>
    `data:${img.mimeType};base64,${img.imageBase64}`;

  return (
    <div className="bg-[#1E1508] border border-[#3D2B0E] rounded-2xl overflow-hidden shadow-card">
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#3D2B0E]/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-[#C4832A]/20 to-[#8B4513]/20 border border-[#3D2B0E]">
            <SparkleIcon className="w-4 h-4 text-[#C4832A]" />
          </span>
          <div>
            <p className="text-[#F0E0C0] text-sm font-semibold">AI Image Generator</p>
            <p className="text-[#A89070] text-xs">Powered by Imagen 4</p>
          </div>
        </div>
        <ChevronIcon
          className={`w-4 h-4 text-[#A89070] transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-[#3D2B0E]/60">
          <p className="text-[#A89070] text-xs pt-3 leading-relaxed">
            Describe an image and let Imagen 4 create it for you. Use the result as your profile photo or save it.
          </p>

          <form onSubmit={handleGenerate} className="flex gap-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="A vibrant city skyline at sunset…"
              maxLength={2000}
              className="flex-1 bg-[#1E1508]/60 border border-[#3D2B0E] text-[#F0E0C0] placeholder:text-[#A89070]/50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C4832A]/50 transition-all"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#C4832A] to-[#8B4513] hover:from-[#D4943B] hover:to-[#9B5523] disabled:opacity-50 text-white font-semibold text-sm transition-all active:scale-[0.98] whitespace-nowrap"
            >
              {loading ? (
                <>
                  <Spinner className="w-4 h-4" />
                  Generating…
                </>
              ) : (
                <>
                  <SparkleIcon className="w-4 h-4" />
                  Generate
                </>
              )}
            </button>
          </form>

          {error && (
            <div className="px-4 py-3 rounded-xl bg-[#8B4513]/10 border border-[#8B4513]/20 text-[#F0E0C0]/80 text-sm">
              {error}
            </div>
          )}

          {images.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {images.map((img, i) => (
                <div key={i} className="group relative rounded-xl overflow-hidden border border-[#3D2B0E] bg-[#1E1508]/40">
                  <img
                    src={toDataUrl(img)}
                    alt={`Generated image ${i + 1}`}
                    className="w-full h-36 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                    {onSelectImage && (
                      <button
                        type="button"
                        onClick={() => onSelectImage(toDataUrl(img))}
                        className="w-full px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#C4832A] to-[#8B4513] text-white text-xs font-semibold hover:from-[#D4943B] hover:to-[#9B5523] transition-colors"
                      >
                        Use as Photo
                      </button>
                    )}
                    <a
                      href={toDataUrl(img)}
                      download={`nearnow-imagen-${i + 1}.png`}
                      className="w-full px-3 py-1.5 rounded-lg bg-white/15 text-white text-xs font-semibold hover:bg-white/25 transition-colors text-center"
                    >
                      Download
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Icons ──────────────────────────────────────────────────────────────────────

const SparkleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" />
  </svg>
);

const ChevronIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const Spinner = ({ className = '' }: { className?: string }) => (
  <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
  </svg>
);
