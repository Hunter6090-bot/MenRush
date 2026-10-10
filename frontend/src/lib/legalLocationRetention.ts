/**
 * Location retention wording for Terms 6.5 and the Privacy retention section.
 * Legal's corrected text (10 Oct 2026), with the post and chat sentences set by
 * Zoul to match today's code. Needs Legal's OK. Do not edit without Legal.
 */
export const LOCATION_RETENTION_TEXT =
  "We keep your current location while your account is open. It's replaced each time your device sends a new one, including when you use Ghost mode, and we delete it when you delete your account. We also keep the location from when you first joined. When you post to the map or the community, we automatically save your exact location with that post. We keep it with the post until you delete your account, even after the post stops showing. A location you share in a chat is kept until you withdraw it or delete your account. We're shortening how long we keep location data and will update this section when that's in place.";

/**
 * Travel trip retention for the Privacy retention section. Describes #359
 * (Travel) and #384 (trip retention): planTrip and endTrip delete the open
 * trip at once (travel.service.ts), purgeEndedTrips deletes trips 30 days
 * after they end (TRAVEL_TRIP_RETENTION_DAYS, hourly worker), and trips are
 * removed with the account (ON DELETE CASCADE). Only true once those merge.
 */
export const TRAVEL_TRIP_RETENTION_TEXT =
  "Travel: when you plan a trip, we keep the city and dates you choose, along with the city's country and its area on the map (worked out from the city, never from your location). If you end the trip with End trip, or replace it with a new one, we delete it straight away. Otherwise we delete it automatically 30 days after the trip ends, or sooner if you delete your account.";
