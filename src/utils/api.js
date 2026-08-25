import { sessionCacheSet, findCachedMatch } from "./storage.js";

const API_BASE_URL = "https://p01--bar-replay-radar--x27hr2kwdwcv.code.run";

const LIST_FILTER_KEYS = [
  "limit",
  "offset",
  "sortBy",
  "sortDir",
  "gamemode",
  "map",
  "playerCountMin",
  "playerCountMax",
  "averageOSMin",
  "averageOSMax",
  "scoreMin",
  "scoreMax",
  "durationMin",
  "durationMax",
  "startTimeAfter",
  "startTimeBefore",
];

/** Parses a fetch Response body as JSON, tolerating an empty/non-JSON body. */
async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Builds the querystring for GET /matches. `filters.milestones` is a flat
 * { [milestoneKey]: boolean } map — passed straight through as one boolean
 * param per key (matches the backend's ?stomp=true&comeback=false scheme),
 * so this doesn't need its own hardcoded list of milestone keys to stay in
 * sync with the backend's.
 */
function buildListParams(filters) {
  const params = new URLSearchParams();
  for (const key of LIST_FILTER_KEYS) {
    const value = filters[key];
    if (value !== undefined && value !== null) params.set(key, String(value));
  }
  for (const [key, value] of Object.entries(filters.milestones ?? {})) {
    if (typeof value === "boolean") params.set(key, String(value));
  }
  return params;
}

/**
 * GET /matches — filtered/sorted/paginated match search. Always hits the
 * backend live (see matchStorage.js header comment for why this isn't cached
 * client-side). Returns the envelope as-is: { matches, total, limit, offset }.
 */
export async function listMatches(filters = {}) {
  const params = buildListParams(filters);
  const res = await fetch(`${API_BASE_URL}/matches?${params.toString()}`);
  if (!res.ok) {
    const body = await safeJson(res);
    throw new Error(body?.error ?? `Failed to list matches (${res.status})`);
  }
  return res.json();
}

/**
 * Raw POST /matches/:id/analyze call — no caching, always hits the backend.
 * Prefer `lookupMatch` below for normal use; this is exposed for a manual
 * "retry" action after a 202/processing response.
 *
 * Returns a discriminated-by-`status` object rather than throwing on the
 * "expected" non-2xx cases (202/404/422), since those are normal outcomes
 * the UI needs to render, not failures:
 *   { status: "ready", match }
 *   { status: "processing", message }
 *   { status: "notFound" }
 *   { status: "insufficientData", error }
 */
export async function requestAnalysis(matchID) {
  const res = await fetch(`${API_BASE_URL}/matches/${matchID}/analyze`, { method: "POST" });

  if (res.status === 200 || res.status === 201) {
    return { status: "ready", match: await res.json() };
  }
  if (res.status === 202) {
    const body = await safeJson(res);
    return {
      status: "processing",
      message: body?.message ?? "Still processing — try again shortly.",
    };
  }
  if (res.status === 404) {
    return { status: "notFound" };
  }
  if (res.status === 422) {
    const body = await safeJson(res);
    return {
      status: "insufficientData",
      error: body?.error ?? "Not enough data to analyze this match.",
    };
  }

  const body = await safeJson(res);
  throw new Error(body?.error ?? `Unexpected response analyzing match ${matchID} (${res.status})`);
}

/**
 * Single-match lookup for the "search by ID" flow. Checks the saved +
 * session caches first (see matchStorage.js) and only calls the backend on a
 * cache miss or when `forceRefresh` is set (e.g. from a manual retry button
 * after a 202). Successful backend lookups are cached for the session.
 */
export async function lookupMatch(matchID, { forceRefresh = false } = {}) {
  if (!forceRefresh) {
    const cached = findCachedMatch(matchID);
    if (cached) return { status: "ready", match: cached };
  }

  const result = await requestAnalysis(matchID);
  if (result.status === "ready") {
    sessionCacheSet(result.match);
  }
  return result;
}