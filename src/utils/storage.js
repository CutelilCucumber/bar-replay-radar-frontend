// ---------------------------------------------------------------------------
// Per-record storage for match data.
//
// Previously everything lived under one giant JSON blob per storage type
// ("saved-matches" in localStorage, "processed-matches" in sessionStorage),
// so touching a single match meant parsing/serializing the entire collection.
// Here each match gets its own key (`saved:{id}` / `processed:{id}`), with a
// small index key holding just the list of IDs for enumeration — reads/writes
// now only ever touch the one record actually being changed.
//
// localStorage = user's manually-saved matches (small, curated, persistent).
// sessionStorage = API fetch cache, to avoid re-hitting gex (larger, capped,
// cleared when the tab closes).
// ---------------------------------------------------------------------------

const SAVED_PREFIX = "saved:";
const SAVED_INDEX_KEY = "saved:index";

const PROCESSED_PREFIX = "processed:";
const PROCESSED_INDEX_KEY = "processed:index";

// Caps how many API results session storage will hold at once. Oldest
// entries (by insertion order in the index) are evicted first. Tune as needed.
const MAX_PROCESSED_MATCHES = 500;

// --- generic per-key helpers, parameterized by which Storage to use --------

function readIndex(storage, indexKey) {
  try {
    const raw = storage.getItem(indexKey);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error(`storage: failed to read index ${indexKey}`, e);
    return [];
  }
}

function writeIndex(storage, indexKey, ids) {
  storage.setItem(indexKey, JSON.stringify(ids));
}

function readRecord(storage, prefix, id) {
  try {
    const raw = storage.getItem(prefix + id);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error(`storage: failed to read ${prefix}${id}`, e);
    return null;
  }
}

function writeRecord(storage, prefix, id, value) {
  storage.setItem(prefix + id, JSON.stringify(value));
}

function deleteRecord(storage, prefix, indexKey, id) {
  storage.removeItem(prefix + id);
  const ids = readIndex(storage, indexKey);
  const next = ids.filter((existingId) => existingId !== id);
  if (next.length !== ids.length) writeIndex(storage, indexKey, next);
}

function upsertIndex(storage, indexKey, id) {
  const ids = readIndex(storage, indexKey);
  if (!ids.includes(id)) {
    ids.push(id);
    writeIndex(storage, indexKey, ids);
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Saved matches (localStorage) — manually saved by the user.
// ---------------------------------------------------------------------------

/** All saved matches, as an array (same shape the old "saved-matches" blob returned). */
export function getSavedMatches() {
  return readIndex(localStorage, SAVED_INDEX_KEY)
    .map((id) => readRecord(localStorage, SAVED_PREFIX, id))
    .filter(Boolean);
}

/** A single saved match by ID, or null. O(1) — doesn't touch the rest of the collection. */
export function getSavedMatch(matchID) {
  return readRecord(localStorage, SAVED_PREFIX, matchID);
}

/**
 * True if a match is already saved. O(1) index lookup — doesn't parse any
 * match records, unlike the old `inCache` which deserialized the whole blob.
 */
export function isMatchSaved(matchID) {
  return readIndex(localStorage, SAVED_INDEX_KEY).includes(matchID);
}

/**
 * Saves a match. Throws (e.g. on quota exceeded) so callers can catch it the
 * same way the old inline try/catch around localStorage.setItem did.
 */
export function saveMatch(match) {
  writeRecord(localStorage, SAVED_PREFIX, match.id, match);
  upsertIndex(localStorage, SAVED_INDEX_KEY, match.id);
}

/** Removes a saved match. No-op if it wasn't saved. */
export function deleteSavedMatch(matchID) {
  deleteRecord(localStorage, SAVED_PREFIX, SAVED_INDEX_KEY, matchID);
}

/** Clears all saved matches. */
export function clearSavedMatches() {
  for (const id of readIndex(localStorage, SAVED_INDEX_KEY)) {
    localStorage.removeItem(SAVED_PREFIX + id);
  }
  localStorage.removeItem(SAVED_INDEX_KEY);
}

// ---------------------------------------------------------------------------
// Processed match cache (sessionStorage) — API fetch results, to avoid
// re-hitting gex for matches already analyzed this session.
// ---------------------------------------------------------------------------

/** All cached processed matches, as an array. */
export function getProcessedMatches() {
  return readIndex(sessionStorage, PROCESSED_INDEX_KEY)
    .map((id) => readRecord(sessionStorage, PROCESSED_PREFIX, id))
    .filter(Boolean);
}

/** A single processed match by ID, or null. O(1). */
export function getProcessedMatch(matchID) {
  return readRecord(sessionStorage, PROCESSED_PREFIX, matchID);
}

/**
 * Caches one processed match (overwrites if already present). Evicts the
 * oldest cached match first if this would exceed MAX_PROCESSED_MATCHES, so
 * session storage can't grow unbounded across a long scanning session.
 */
export function sessionCacheSet(match) {
  try {
    writeRecord(sessionStorage, PROCESSED_PREFIX, match.id, match);
    const ids = upsertIndex(sessionStorage, PROCESSED_INDEX_KEY, match.id);

    if (ids.length > MAX_PROCESSED_MATCHES) {
      const overflow = ids.length - MAX_PROCESSED_MATCHES;
      const evicted = ids.slice(0, overflow);
      const kept = ids.slice(overflow);
      for (const id of evicted) sessionStorage.removeItem(PROCESSED_PREFIX + id);
      writeIndex(sessionStorage, PROCESSED_INDEX_KEY, kept);
    }
  } catch (e) {
    console.error("Session storage error:", e);
  }
}

/** Clears the entire processed-match cache. */
export function clearProcessedCache() {
  for (const id of readIndex(sessionStorage, PROCESSED_INDEX_KEY)) {
    sessionStorage.removeItem(PROCESSED_PREFIX + id);
  }
  sessionStorage.removeItem(PROCESSED_INDEX_KEY);
}

// ---------------------------------------------------------------------------
// Combined saved + processed lookups.
// ---------------------------------------------------------------------------

/** Combined array of saved (local) + processed (session) matches, saved first. */
export function bothCacheGet() {
  try {
    return [...getSavedMatches(), ...getProcessedMatches()];
  } catch (e) {
    console.error("Storage error:", e);
    return [];
  }
}

/**
 * Point lookup across BOTH caches without materializing the combined array —
 * use this instead of `bothCacheGet().find(m => m.id === id)`, which
 * deserializes every record just to check one ID.
 */
export function findCachedMatch(matchID) {
  return getSavedMatch(matchID) ?? getProcessedMatch(matchID);
}