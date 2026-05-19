import type { PersonSummary } from "./types.js";

export const MOCK_PEOPLE: PersonSummary[] = [
  {
    id: "person-alina",
    name: "Alina",
    age: 27,
    bio: "Sunrise runner, product designer, and local coffee-shop scout looking for someone spontaneous enough to try a new neighborhood every weekend.",
    bioSnippet: "Sunrise runner and local coffee-shop scout.",
    distanceKm: 0.9,
    interests: ["coffee", "running", "design"],
    online: true,
    lastSeen: new Date().toISOString(),
    photoUrl: null
  },
  {
    id: "person-samir",
    name: "Samir",
    age: 30,
    bio: "Backend engineer who breaks up debugging sessions with pickup basketball, street food runs, and late-night jazz playlists.",
    bioSnippet: "Backend engineer into basketball and jazz.",
    distanceKm: 1.7,
    interests: ["basketball", "food", "jazz"],
    online: true,
    lastSeen: new Date().toISOString(),
    photoUrl: null
  },
  {
    id: "person-zoe",
    name: "Zoe",
    age: 26,
    bio: "Part-time ceramicist, full-time museum wanderer, always planning one more city walk before sunset.",
    bioSnippet: "Ceramicist and museum wanderer.",
    distanceKm: 2.3,
    interests: ["art", "walks", "museums"],
    online: false,
    lastSeen: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    photoUrl: null
  },
  {
    id: "person-luca",
    name: "Luca",
    age: 29,
    bio: "Climber, espresso loyalist, and the friend who always has a map open before anyone asks where to go next.",
    bioSnippet: "Climber with a permanent map open.",
    distanceKm: 3.4,
    interests: ["climbing", "maps", "coffee"],
    online: true,
    lastSeen: new Date().toISOString(),
    photoUrl: null
  },
  {
    id: "person-maya",
    name: "Maya",
    age: 28,
    bio: "Bookstore browser, amateur cook, and patient listener who likes thoughtful conversations more than small talk.",
    bioSnippet: "Bookstore browser and amateur cook.",
    distanceKm: 4.2,
    interests: ["books", "cooking", "conversation"],
    online: false,
    lastSeen: new Date(Date.now() - 1000 * 60 * 53).toISOString(),
    photoUrl: null
  }
];
