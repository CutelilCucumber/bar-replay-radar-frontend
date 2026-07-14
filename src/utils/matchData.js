import { bucketFrameStatsToSeries } from "./buildSeries.js";
import { bothCacheGet, sessionCacheSet } from "./storage.js";
/**
 * https://gex.honu.pw/api-doc/index.html
 * Token bucket matching gex's stated policy: starts with 300 requests,
 * refills 60/min (1/sec) up to 300.
 */
class RateLimiter {
  constructor(capacity, refillPerSec) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillPerSec = refillPerSec;
    this.lastRefill = Date.now();
  }
  async acquire() {
    for (;;) {
      const now = Date.now();
      const elapsed = (now - this.lastRefill) / 1000;
      this.tokens = Math.min(
        this.capacity,
        this.tokens + elapsed * this.refillPerSec,
      );
      this.lastRefill = now;
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      const waitMs = ((1 - this.tokens) / this.refillPerSec) * 1000;
      await new Promise((r) => setTimeout(r, Math.max(50, waitMs)));
    }
  }
}
const rateLimiter = new RateLimiter(300, 1);

async function getJson(url) {
  //fetch the thing
  await rateLimiter.acquire();
  const res = await fetch(url, {
    referrerPolicy: "strict-origin-when-cross-origin",
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const body = await res.json();
  return body.data ?? body;
}
/**
 * Builds the query string and hits /api/match/search.
 */
async function searchMatches(baseUrl, filters) {
  const { limit, gamemode, minDurationMinutes, minPlayers, minimumAverageOS } =
    filters;

  const params = new URLSearchParams({
    limit: String(limit),
    orderBy: "start_time",
    orderByDir: "desc",
    ranked: "true",
    processingAction: "true", // teamStats only exist once the action log is parsed
    includePlayerLeaves: "true", // for the quick-forfeit milestone
    includeSpectators: "true", // for audience-size context
    includeMapDraws: "true", // for the "artistic players" milestone
  });

  if (gamemode) params.set("gamemode", String(gamemode));
  if (minimumAverageOS)
    params.set("minimumAverageOS", String(minimumAverageOS));
  if (minDurationMinutes) {
    params.set("durationMinimum", String(minDurationMinutes * 60 * 1000));
  }
  if (minPlayers) params.set("playerCountMinimum", String(minPlayers));

  return getJson(`${baseUrl}/api/match/search?${params.toString()}`);
}

/**
 * Looks up a match in the local cache by id.
 */
function findInCache(matchId) {
  return bothCacheGet().find((match) => match.id === matchId) ?? null;
}

/**
 * Fetches a single match's event log and shapes it into the record our UI/cache expects.
 * Returns null if the match doesn't have enough data to be useful (no team stats,
 * missing ally teams, or too short a stat series to plot).
 */
async function buildMatchRecord(baseUrl, summary) {
  const eventParams = new URLSearchParams({
    includeTeamStats: "true",
    includeExtraStats: "true",
    includeWindUpdates: "true",
    includeUnitsCreated: "true",
    includeUnitsKilled: "true",
    includeUnitDamage: "true",
    includeUnitDefs: "true",
    includeUnitResources: "true",
    includeFactoryUnitCreate: "true",
    includeTeamDiedEvents: "true",
    includeCommanderPositionUpdates: "true",
  });

  const eventJson = await getJson(
    `${baseUrl}/api/game-event/${summary.id}?${eventParams.toString()}`,
  );

  // /api/game-event/{id} returns 204 (empty body) if the match hasn't been
  // processed yet — getJson resolves to null/undefined in that case.
  if (!eventJson) return null;

  // teamStats is documented nullable; treat missing as "no data yet".
  const teamStats = eventJson.teamStats ?? [];
  const { players, allyTeams } = summary;

  if (teamStats.length === 0 || allyTeams.length < 2) return null;

  const durationMin = Math.round(summary.durationMs / 60000);
  const dataset = bucketFrameStatsToSeries(
    eventJson,
    players,
    allyTeams,
    durationMin,
  );
  if (dataset.series.length < 3) return null;

  const allyIds = getSortedAllyIds(allyTeams);
  const winnerSide = getWinnerSide(allyTeams, allyIds);

  return {
    id: summary.id,
    map: summary.map ?? "unknown map",
    gamemode: String(summary.gamemode ?? ""),
    playerCount: summary.playerCount ?? players.length,
    averageOS: summary.averageOS,
    durationMin,
    startTime: summary.startTime,
    teamA: {
      name: "Ally Team A",
      skill: averageSkill(players, allyIds[0]),
      players: [],
      facts: dataset.teamFacts.A,
    },
    teamB: {
      name: "Ally Team B",
      skill: averageSkill(players, allyIds[1]),
      players: [],
      facts: dataset.teamFacts.B,
    },
    winner: winnerSide,
    series: dataset.series,
    wind: dataset.wind,
    unitDefsById: dataset.unitDefsById,
    playerLeaves: summary.playerLeaves ?? [],
    spectatorCount: summary.spectators?.length ?? 0,
    mapDraws: summary.mapDraws ?? [],
    legionMatch: dataset.legionMatch,
  };
}

/**
 * Returns the two allyTeamIDs in this match, sorted ascending, so "A"/"B" are
 * assigned consistently regardless of which side actually won.
 */
function getSortedAllyIds(allyTeams) {
  return [...new Set(allyTeams.map((a) => a.allyTeamID))].sort((x, y) => x - y);
}

/**
 * Maps the winning allyTeam to our "A"/"B" labels (A = lower allyTeamID).
 */
function getWinnerSide(allyTeams, allyIds) {
  const winningAlly = allyTeams.find((a) => a.won);
  return winningAlly?.allyTeamID === allyIds[0] ? "A" : "B";
}

/**
 * Average player skill for one ally team. Falls back to 20 (a neutral default)
 * when a side has no players, e.g. malformed data.
 */
function averageSkill(players, allyId) {
  const teamPlayers = players.filter((p) => p.allyTeamID === allyId);
  if (teamPlayers.length === 0) return 20;

  const total = teamPlayers.reduce((sum, p) => sum + Number(p.skill ?? 20), 0);
  return total / teamPlayers.length;
}
/**
 * Fetches recent ranked matches from the Gex API and enriches each one with
 * its team-stats time series, pulled from /api/game-event/{id}.
 *
 * API routes used (https://gex.honu.pw/api-doc/index.html):
 *   GET /api/match/search   -> paginated match summaries (map, players, allyTeams, ...)
 *   GET /api/game-event/:id -> per-match event log; ?includeTeamStats=true adds
 *                               the periodic teamStats snapshots used to build `series`
 *
 * @param {string} baseUrl - API origin, e.g. "https://gex.honu.pw"
 * @param {object} filters
 * @param {number} filters.limit
 * @param {number|string} [filters.gamemode]
 * @param {number} [filters.minDurationMinutes]
 * @param {number} [filters.minPlayers]
 * @param {number} [filters.minimumAverageOS]
 * @param {(msg: string) => void} [setProgress] - optional progress callback
 * @returns {Promise<object[]>} built match records, ready for the UI/cache
 */
export async function fetchLiveMatches(baseUrl, filters, setProgress) {
  const matchSummaries = await searchMatches(baseUrl, filters);

  const results = [];
  for (const [index, summary] of matchSummaries.entries()) {
    setProgress?.(
      `analyzing ${summary.map ?? summary.id} (${index + 1}/${matchSummaries.length})`,
    );

    const cached = findInCache(summary.id);
    if (cached) {
      results.push(cached);
      continue;
    }

    try {
      const built = await buildMatchRecord(baseUrl, summary);
      if (built) {
        await sessionCacheSet(built);
        results.push(built);
      }
    } catch (err) {
      // Keep the batch resilient — one bad/unparseable match shouldn't kill the run.
      console.error(`failed to process match ${summary.id}:`, err);
    }
  }

  return results;
}
