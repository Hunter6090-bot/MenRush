import { MOCK_PEOPLE } from "./mockData.js";
import type {
  IntroMessageResult,
  NearbySearchInput,
  NearbySearchResult,
  NearNowMode,
  PersonSummary
} from "./types.js";

function getMode(): NearNowMode {
  return process.env.NEARNOW_SOURCE_MODE === "api" ? "api" : "mock";
}

function buildUrl(pathname: string, params?: URLSearchParams): string {
  const base = process.env.NEARNOW_API_BASE_URL ?? "http://localhost:3000";
  const url = new URL(pathname, base.endsWith("/") ? base : `${base}/`);
  if (params) {
    url.search = params.toString();
  }
  return url.toString();
}

function authHeaders(): HeadersInit {
  const token = process.env.NEARNOW_BEARER_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function matchesInterests(candidate: PersonSummary, interests?: string[]): boolean {
  if (!interests?.length) {
    return true;
  }

  const candidateSet = new Set(candidate.interests.map((interest) => interest.toLowerCase()));
  return interests.some((interest) => candidateSet.has(interest.toLowerCase()));
}

export async function findNearbyPeople(input: NearbySearchInput): Promise<NearbySearchResult> {
  const mode = getMode();
  const limit = input.limit ?? 8;

  if (mode === "api") {
    const params = new URLSearchParams({
      lat: String(input.lat),
      lng: String(input.lng),
      radius: String(input.radiusKm)
    });

    if (input.minAge !== undefined) {
      params.set("minAge", String(input.minAge));
    }
    if (input.maxAge !== undefined) {
      params.set("maxAge", String(input.maxAge));
    }
    if (input.interests?.length) {
      params.set("interests", input.interests.join(","));
    }

    const response = await fetch(buildUrl("/api/users/nearby", params), {
      headers: {
        Accept: "application/json",
        ...authHeaders()
      }
    });

    if (!response.ok) {
      throw new Error(`NearNow nearby search failed with ${response.status}`);
    }

    const data = (await response.json()) as Array<Record<string, unknown>>;
    const people: PersonSummary[] = data.slice(0, limit).map((person) => ({
      id: String(person.id),
      name: String(person.name),
      age: Number(person.age),
      bio: String(person.bio ?? ""),
      bioSnippet: String(person.bio ?? "").slice(0, 96),
      distanceKm: Number(person.distance_km ?? 0),
      interests: Array.isArray(person.interests)
        ? person.interests.map((interest) => String(interest))
        : [],
      online: Boolean(person.online),
      photoUrl: person.photo_url ? String(person.photo_url) : null,
      lastSeen: person.last_seen ? String(person.last_seen) : null
    }));

    return {
      mode,
      origin: {
        lat: input.lat,
        lng: input.lng,
        radiusKm: input.radiusKm
      },
      people
    };
  }

  const people = MOCK_PEOPLE.filter((person) => {
    if (input.minAge !== undefined && person.age < input.minAge) {
      return false;
    }
    if (input.maxAge !== undefined && person.age > input.maxAge) {
      return false;
    }
    return matchesInterests(person, input.interests);
  }).slice(0, limit);

  return {
    mode,
    origin: {
      lat: input.lat,
      lng: input.lng,
      radiusKm: input.radiusKm
    },
    people
  };
}

export async function sendIntroMessage(
  recipientId: string,
  message: string,
  recipientName?: string
): Promise<IntroMessageResult> {
  const mode = getMode();
  const trimmedMessage = message.trim();

  if (!trimmedMessage) {
    throw new Error("Message must not be empty.");
  }

  if (mode === "api") {
    const response = await fetch(buildUrl("/api/messages"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...authHeaders()
      },
      body: JSON.stringify({
        receiver_id: recipientId,
        message: trimmedMessage
      })
    });

    if (!response.ok) {
      throw new Error(`NearNow message send failed with ${response.status}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    return {
      mode,
      recipientId,
      recipientName,
      message: String(data.message ?? trimmedMessage),
      sentAt: String(data.created_at ?? new Date().toISOString())
    };
  }

  return {
    mode,
    recipientId,
    recipientName,
    message: trimmedMessage,
    sentAt: new Date().toISOString()
  };
}
