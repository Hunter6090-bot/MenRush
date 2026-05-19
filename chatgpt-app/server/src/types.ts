export type NearNowMode = "mock" | "api";

export interface NearbySearchInput {
  lat: number;
  lng: number;
  radiusKm: number;
  minAge?: number;
  maxAge?: number;
  interests?: string[];
  limit?: number;
}

export interface PersonSummary {
  id: string;
  name: string;
  age: number;
  bio: string;
  bioSnippet: string;
  distanceKm: number;
  interests: string[];
  online: boolean;
  photoUrl?: string | null;
  lastSeen?: string | null;
}

export interface NearbySearchResult {
  mode: NearNowMode;
  origin: {
    lat: number;
    lng: number;
    radiusKm: number;
  };
  people: PersonSummary[];
}

export interface IntroMessageResult {
  mode: NearNowMode;
  recipientId: string;
  recipientName?: string;
  message: string;
  sentAt: string;
}

export interface SnapshotRecord {
  id: string;
  createdAt: string;
  search: NearbySearchInput;
  result: NearbySearchResult;
}
