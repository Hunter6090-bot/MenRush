import { useState } from 'react';
import type { HotSpotDTO } from '../api/client';
import {
  mapToCruisingCategory,
  formatLastActiveTime,
  getDirectionsUrl,
  CRUISING_CATEGORY_META,
} from '../lib/cruising';
import { formatDistanceFromKm } from '../lib/localeUnits';
import { CruisingSpotMapThumbnail } from './CruisingSpotMapThumbnail';

interface CruisingSpotCardProps {
  spot: HotSpotDTO;
  onSelect?: (spot: HotSpotDTO) => void;
  onCheckIn?: (spot: HotSpotDTO, anonymous: boolean) => void | Promise<void>;
  onOpenReviews?: (spot: HotSpotDTO) => void;
  acting?: boolean;
}

export function CruisingSpotCard({
  spot,
  onSelect,
  onCheckIn,
  onOpenReviews,
  acting = false,
}: CruisingSpotCardProps) {
  const category = mapToCruisingCategory(spot);
  const categoryMeta = CRUISING_CATEGORY_META[category];
  const lastActive = formatLastActiveTime(spot);
  const isCurrentlyActive = Boolean(spot.has_active_checkins || spot.live_count_exact > 0);
  const directionsUrl = getDirectionsUrl(spot.latitude, spot.longitude, spot.name);
  const ttlHours = spot.checkin_ttl_hours ?? 2;

  return (
    <article
      data-testid={`cruising-spot-card-${spot.id}`}
      className="group relative flex flex-col gap-3 rounded-2xl border border-[#3D2B0E] bg-[#1E1508] p-3.5 shadow-sm transition-all hover:border-[var(--copper)]/40 hover:shadow-md sm:flex-row sm:items-start"
    >
      {/* Small map thumbnail */}
      <CruisingSpotMapThumbnail
        latitude={spot.latitude}
        longitude={spot.longitude}
        name={spot.name}
      />

      {/* Main card info */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Category & distance pill row */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            data-testid="cruising-category-badge"
            className="inline-flex items-center gap-1 rounded-full border border-[#C4832A]/40 bg-[#C4832A]/15 px-2.5 py-0.5 text-[11px] font-bold text-[#E0A14A]"
          >
            <span aria-hidden="true">{categoryMeta.icon}</span>
            <span>{categoryMeta.label}</span>
          </span>

          {spot.distance_km != null ? (
            <span
              data-testid="cruising-distance"
              className="inline-flex items-center rounded-full border border-[#3D2B0E] bg-[#0D0A06]/90 px-2.5 py-0.5 text-[11px] font-semibold text-[#F0E0C0]"
            >
              {formatDistanceFromKm(Number(spot.distance_km))}
            </span>
          ) : null}

          {spot.city ? (
            <span className="text-[11px] font-medium text-[#F0E0C0]/90">· {spot.city}</span>
          ) : null}

          {/* Review rating badge if reviews exist */}
          {spot.rating_avg != null && (spot.review_count ?? 0) > 0 ? (
            <span
              data-testid="cruising-card-rating"
              className="inline-flex items-center gap-0.5 text-[11px] font-bold text-[#E0A14A]"
            >
              ★ {spot.rating_avg}
              <span className="text-[10px] text-[#F0E0C0]/75">({spot.review_count})</span>
            </span>
          ) : null}
        </div>

        {/* Spot Name */}
        <h3
          className="mt-1 text-base font-extrabold leading-tight text-[#F0E0C0]"
          data-testid="cruising-spot-name"
        >
          {spot.name}
        </h3>

        {/* Description if present */}
        {spot.description ? (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#F0E0C0]/80">
            {spot.description}
          </p>
        ) : null}

        {/* Last Active Time status indicator */}
        <div
          className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium"
          data-testid="cruising-last-active"
        >
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                isCurrentlyActive ? 'bg-[#3D7A2E] shadow-[0_0_6px_#3D7A2E]' : 'bg-[rgba(240,224,192,0.35)]'
              }`}
              aria-hidden="true"
            />
            <span
              className={
                isCurrentlyActive ? 'font-bold text-[#8FC773]' : 'text-[#F0E0C0]/85'
              }
            >
              {lastActive}
            </span>
          </div>

          <span className="text-[10px] text-[#F0E0C0]/75">
            · {ttlHours}h signal
          </span>
        </div>

        {/* Action Row — streamlined icon buttons with tooltips <= 2 words */}
        <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-[#3D2B0E]/70">
          {/* Directions — opens Apple Maps / Google Maps */}
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Directions"
            aria-label="Directions"
            data-testid="cruising-get-directions"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#C4832A] text-[#1A0E03] shadow-sm transition-all hover:bg-[#E0A14A] active:scale-95"
            onClick={(e) => e.stopPropagation()}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="3 11 22 2 13 21 11 13 3 11" />
            </svg>
          </a>

          {/* Anonymous check-in / check-out button */}
          {onCheckIn ? (
            spot.is_checked_in ? (
              <button
                type="button"
                disabled={acting}
                onClick={(e) => {
                  e.stopPropagation();
                  void onCheckIn(spot, false);
                }}
                title="Checked in"
                aria-label="Checked in"
                data-testid={`cruising-checkout-${spot.id}`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#C4832A]/60 bg-[#C4832A]/20 text-[#E0A14A] transition-all hover:bg-[#C4832A]/30 active:scale-95 disabled:opacity-50"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <polyline points="9 10 11 12 15 8" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                disabled={acting}
                onClick={(e) => {
                  e.stopPropagation();
                  void onCheckIn(spot, true);
                }}
                title="Check in"
                aria-label="Check in"
                data-testid={`cruising-checkin-anon-${spot.id}`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#3D2B0E] bg-[#0D0A06]/90 text-[#F0E0C0] transition-all hover:border-[#C4832A]/60 hover:text-[#E0A14A] active:scale-95 disabled:opacity-50"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </button>
            )
          ) : null}

          {/* Reviews button (1–5 + short text) */}
          {onOpenReviews ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenReviews(spot);
              }}
              title="Reviews"
              aria-label="Reviews"
              data-testid={`cruising-reviews-btn-${spot.id}`}
              className={`inline-flex h-9 items-center justify-center rounded-full border border-[#3D2B0E] bg-[#0D0A06]/90 text-[#F0E0C0] transition-all hover:border-[#C4832A]/60 hover:text-[#E0A14A] active:scale-95 ${
                (spot.review_count ?? 0) > 0 ? 'px-2.5 gap-1' : 'w-9'
              }`}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="1"
                aria-hidden="true"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              {(spot.review_count ?? 0) > 0 ? (
                <span className="text-[11px] font-bold text-[#E0A14A]">
                  {spot.review_count}
                </span>
              ) : null}
            </button>
          ) : null}

          {/* View on map (if onSelect handler provided) */}
          {onSelect ? (
            <button
              type="button"
              onClick={() => onSelect(spot)}
              title="Map"
              aria-label="Map"
              data-testid="cruising-view-on-map"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#3D2B0E] bg-[#0D0A06]/90 text-[#F0E0C0] transition-all hover:border-[#C4832A]/60 hover:text-[#E0A14A] active:scale-95"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                <line x1="8" y1="2" x2="8" y2="18" />
                <line x1="16" y1="6" x2="16" y2="22" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
