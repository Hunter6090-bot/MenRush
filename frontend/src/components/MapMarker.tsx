import { useState } from "react";
import { createRoot, Root } from "react-dom/client";
import { fallbackAvatarForAge, resolveAssetUrl } from "../lib/assetUrl";
import { PulsingAvatar } from "./PulsingAvatar";
import { getPhotoUrl } from "./UserAvatar";

export interface MapMarkerUser {
  id: string;
  name: string;
  photo_url?: string;
  isPulsing: boolean;
  isVerified?: boolean;
}

interface MapMarkerProps {
  user: MapMarkerUser;
  size?: number;
}

export function MapMarker({ user, size = 44 }: MapMarkerProps) {
  const photo = getPhotoUrl(user.photo_url);
  return (
    <div
      className={`cursor-pointer transition-transform duration-150 hover:scale-110 ${
        user.isPulsing ? "animate-pulse-breathe" : ""
      }`}
      style={{ width: size, height: size }}
    >
      <PulsingAvatar
        isPulsing={user.isPulsing}
        size={size}
        intensity={user.isPulsing ? "live" : "subtle"}
        isVerified={user.isVerified}
      >
        <div
          className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg,#2A1C0A,#1E1508)",
            border: user.isPulsing ? "3px solid var(--copper-light)" : "2px solid var(--copper)",
            boxShadow: user.isPulsing
              ? "0 0 20px rgba(196,131,42,0.75), 0 4px 14px rgba(196,131,42,0.55)"
              : "0 3px 10px rgba(196,131,42,0.45)",
          }}
        >
          <MapPhoto name={user.name} photo={photo} />
        </div>
      </PulsingAvatar>
    </div>
  );
}

function MapPhoto({ name, photo }: { name: string; photo?: string }) {
  const [src, setSrc] = useState(photo);
  const [failed, setFailed] = useState(false);
  if (!src) {
    return (
      <span
        className="flex h-full w-full items-center justify-center text-sm font-extrabold uppercase text-[var(--copper)]"
        aria-hidden
      >
        {name.trim().charAt(0) || "?"}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={name}
      className="w-full h-full object-cover"
      draggable={false}
      onError={() => {
        if (failed) {
          setSrc(undefined);
          return;
        }
        setFailed(true);
        setSrc(resolveAssetUrl(fallbackAvatarForAge()) ?? "/avatars/generic/05.svg");
      }}
    />
  );
}

export function createMapMarkerElement(
  user: MapMarkerUser,
  onTap: () => void,
  size = 44,
): { element: HTMLDivElement; root: Root } {
  const el = document.createElement("div");
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    onTap();
  });
  const root = createRoot(el);
  root.render(<MapMarker user={user} size={size} />);
  return { element: el, root };
}
