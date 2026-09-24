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
      className="group relative flex flex-col gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3.5 shadow-sm transition-all hover:border-[var(--copper)]/40 hover:shadow-md sm:flex-row sm:items-start"
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
            className="inline-flex items-center gap-1 rounded-full border border-[#C4832A]/30 bg-[#C4832A]/10 px-2.5 py-0.5 text-[11px] font-bold text-[#E0A14A]"
          >
            <span aria-hidden="true">{categoryMeta.icon}</span>
            <span>{categoryMeta.label}</span>
          </span>

          {spot.distance_km != null ? (
            <span
              data-testid="cruising-distance"
              className="inline-flex items-center rounded-full border border-[var(--border-default)] bg-black/25 px-2 py-0.5 text-[11px] font-semibold text-[var(--cream-soft)]"
            >
              {formatDistanceFromKm(Number(spot.distance_km))}
            </span>
          ) : null}

          {spot.city ? (
            <span className="text-[11px] text-[var(--cream-muted)]">· {spot.city}</span>
          ) : null}

          {/* Review rating badge if reviews exist */}
          {spot.rating_avg != null && (spot.review_count ?? 0) > 0 ? (
            <span
              data-testid="cruising-card-rating"
              className="inline-flex items-center gap-0.5 text-[11px] font-bold text-[#E0A14A]"
            >
              ★ {spot.rating_avg}
              <span className="text-[10px] text-[var(--cream-muted)]">({spot.review_count})</span>
            </span>
          ) : null}
        </div>

        {/* Spot Name */}
        <h3
          className="mt-1 text-base font-extrabold leading-tight text-[var(--cream)]"
          data-testid="cruising-spot-name"
        >
          {spot.name}
        </h3>

        {/* Description if present */}
        {spot.description ? (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--cream-muted)]">
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
                isCurrentlyActive ? 'font-bold text-[#8FC773]' : 'text-[var(--cream-muted)]'
              }
            >
              {lastActive}
            </span>
          </div>

          <span className="text-[10px] text-[var(--cream-muted)]">
            · {ttlHours}h signal
          </span>
        </div>

        {/* Action Row */}
        <div className="mt-3 flex flex-wrap items-center gap-2 pt-1 border-t border-[var(--border-default)]/40">
          {/* Get directions — opens Apple Maps / Google Maps */}
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="cruising-get-directions"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#C4832A] px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wide text-[#1A0E03] transition-colors hover:bg-[#E0A14A]"
            onClick={(e) => e.stopPropagation()}
          >
            <svg
              width="13"
              height="13"
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
            Get directions
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
                data-testid={`cruising-checkout-${spot.id}`}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--copper)]/50 bg-[#C4832A]/10 px-3 py-1.5 text-xs font-bold text-[#E0A14A] transition-colors hover:bg-[#C4832A]/20"
              >
                {acting ? 'Updating…' : 'Checked in (Leave)'}
              </button>
            ) : (
              <button
                type="button"
                disabled={acting}
                onClick={(e) => {
                  e.stopPropagation();
                  void onCheckIn(spot, true);
                }}
                data-testid={`cruising-checkin-anon-${spot.id}`}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--border-default)] bg-black/25 px-3 py-1.5 text-xs font-bold text-[var(--cream)] transition-colors hover:border-[var(--copper)]/50 hover:bg-[#C4832A]/10"
              >
                {acting ? 'Checking in…' : 'Check in anonymously'}
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
              data-testid={`cruising-reviews-btn-${spot.id}`}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--border-default)] bg-black/20 px-3 py-1.5 text-xs font-bold text-[var(--cream-soft)] transition-colors hover:border-[var(--copper)]/50 hover:text-[var(--cream)]"
            >
              <span>Reviews</span>
              {(spot.review_count ?? 0) > 0 ? (
                <span className="rounded-full bg-black/40 px-1.5 py-0.2 text-[10px] text-[#E0A14A]">
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
              data-testid="cruising-view-on-map"
              className="inline-flex items-center gap-1 rounded-full border border-[var(--border-default)] bg-black/20 px-3 py-1.5 text-xs font-bold text-[var(--cream-soft)] transition-colors hover:border-[var(--copper)]/50 hover:text-[var(--cream)]"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
              </svg>
              View on map
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
