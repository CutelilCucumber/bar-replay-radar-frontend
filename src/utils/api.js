import { buildSeries, bucketFrameStatsToSeries } from "./buildSeries.js";
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

function bothCacheGet() {
  //return a combined array of local and session storage
  try {
    let localMatches = [];
    const localData = localStorage.getItem("cachedMatches");
    if (localData) localMatches = JSON.parse(localData);

    let sessionMatches = [];
    const sessionData = sessionStorage.getItem("cachedMatches");
    if (sessionData) sessionMatches = JSON.parse(sessionData);

    return [...localMatches, ...sessionMatches];
  } catch (e) {
    console.log("Session storage Error: ", e);
  }
}

function sessionCacheSet(match) {
  try {
    let sessionMatches = [];
    const sessionData = sessionStorage.getItem("cachedMatches");
    if (sessionData) sessionMatches = JSON.parse(sessionData);
    const combined = [...sessionMatches, match];

    sessionStorage.setItem("cachedMatches", JSON.stringify(combined));
  } catch (e) {
    console.log("Session storage Error: ", e);
  }
}

export async function fetchLiveMatches(baseUrl, filters, setProgress) {
  const { limit, gamemode, minDurationMinutes, minPlayers, minimumAverageOS } =
    filters;

  const params = new URLSearchParams({
    limit: String(limit),
    orderBy: "start_time",
    orderByDir: "desc",
    ranked: "true",
    processingAction: "true", // TeamStats only exist once the action log is parsed
  });
  if (gamemode) params.set("gamemode", String(gamemode));
  if (minimumAverageOS)
    params.set("minimumAverageOS", String(minimumAverageOS));
  if (minDurationMinutes)
    params.set("durationMinimum", String(minDurationMinutes * 60 * 1000));
  if (minPlayers) params.set("playerCountMinimum", String(minPlayers));

  const matchesJson = await getJson(
    `${baseUrl}/api/match/search?${params.toString()}`,
  );

  const results = [];
  let done = 0;
  for (const m of matchesJson) {
    setProgress?.(
      `analyzing ${m.map ?? m.id} (${++done}/${matchesJson.length})`,
    );
    const cache = bothCacheGet();
    const foundInCache = cache.find((match) => match.id === m.id);
    if (foundInCache) {
      console.log(foundInCache, "Fetched from cache.");
      results.push(foundInCache);
      continue;
    }

    try {
      const evJson = await getJson(
        `${baseUrl}/api/game-event/${m.id}?includeTeamStats=true`,
      );
      console.log(m.id, "Fetched from API.");

      const teamStats = evJson.teamStats;
      const players = m.players;
      const allyTeams = m.allyTeams;
      if (teamStats.length === 0 || allyTeams.length < 2) continue;

      const durationMin = Math.round(m.durationMs / 60000);
      const series = bucketFrameStatsToSeries(
        teamStats,
        players,
        allyTeams,
        durationMin,
      );
      if (series.length < 3) continue;

      const winningAlly = allyTeams.find((a) => a.won);
      const allyIds = [...new Set(allyTeams.map((a) => a.allyTeamID))].sort(
        (x, y) => x - y,
      );
      const winner =
        winningAlly && winningAlly.allyTeamID === allyIds[0] ? "A" : "B";

      const skillOf = (allyId) => {
        const ps = players.filter((p) => p.allyTeamID === allyId);
        if (ps.length === 0) return 20;
        return ps.reduce((s, p) => s + Number(p.skill ?? 20), 0) / ps.length;
      };

      const built = {
        id: m.id,
        map: m.map ?? "unknown map",
        gamemode: String(m.gamemode ?? ""),
        playerCount: m.playerCount ?? players.length,
        durationMin,
        startTime: m.startTime,
        teamA: { name: "Ally Team A", skill: skillOf(allyIds[0]), players: [] },
        teamB: { name: "Ally Team B", skill: skillOf(allyIds[1]), players: [] },
        winner,
        series,
      };
      await sessionCacheSet(built);
      results.push(built);
    } catch (e) {
      console.log(e);
      // skip matches we fail to fetch/parse — keep the batch resilient
      continue;
    }
  }
  return results;
}
