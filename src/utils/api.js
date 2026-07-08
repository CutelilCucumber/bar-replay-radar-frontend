import { buildSeries } from "./buildSeries.js";
import { FRAMES_PER_SECOND, CUMULATIVE } from "./globalVars.js";
/**
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
  await rateLimiter.acquire();
  const res = await fetch(url, {
    referrerPolicy: "strict-origin-when-cross-origin",
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const body = await res.json();
  return body.data ?? body;
}

async function cacheGet(key) {
  try {
    const r = await window.storage.get(key, false);
    return r ? JSON.parse(r.value) : null;
  } catch {
    return null;
  }
}
async function cacheSet(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value), false);
  } catch {}
}

function bucketFrameStatsToSeries(teamStats, players, allyTeams, durationMin) {
  // teamStats: GameEventTeamStats[] with {teamID, frame, metalProduced, energyProduced, damageDealt,...}
  // players: BarMatchPlayer[] to map teamID -> allyTeamID
  const teamToAlly = {};
  for (const p of players)
    teamToAlly[p.TeamID ?? p.teamID] = p.AllyTeamID ?? p.allyTeamID;

  const allyIds = [
    ...new Set(allyTeams.map((a) => a.AllyTeamID ?? a.allyTeamID)),
  ].sort((a, b) => a - b);
  const [allyA, allyB] = allyIds; // 1v1 ally-team framing; extend for FFA if needed

  const buckets = new Map(); // minute -> { ecoA, ecoB, dmgA, dmgB }
  const bucketSize = 60 * FRAMES_PER_SECOND;

  for (const row of teamStats) {
    const teamID = row.teamID ?? row.TeamID;
    const ally = teamToAlly[teamID];
    if (ally == null) continue;
    const frame = row.frame ?? row.Frame;
    const minute = Math.floor(frame / bucketSize);
    const eco =
      Number(row.metalProduced ?? row.MetalProduced ?? 0) +
      Number(row.energyProduced ?? row.EnergyProduced ?? 0) / 60;
    const dmg = Number(row.damageDealt ?? row.DamageDealt ?? 0);

    const b = buckets.get(minute) || {
      ecoA: 0,
      ecoB: 0,
      dmgA: 0,
      dmgB: 0,
      seenA: false,
      seenB: false,
    };
    if (ally === allyA) {
      b.ecoA = CUMULATIVE ? Math.max(b.ecoA, eco) : b.ecoA + eco;
      b.dmgA = CUMULATIVE ? Math.max(b.dmgA, dmg) : b.dmgA + dmg;
    }
    if (ally === allyB) {
      b.ecoB = CUMULATIVE ? Math.max(b.ecoB, eco) : b.ecoB + eco;
      b.dmgB = CUMULATIVE ? Math.max(b.dmgB, dmg) : b.dmgB + dmg;
    }
    buckets.set(minute, b);
  }

  const minutes = [...buckets.keys()].sort((a, b) => a - b);
  return buildSeries(
    minutes.map((t) => {
      const b = buckets.get(t);
      return [t, b.ecoA, b.ecoB, b.dmgA, b.dmgB];
    }),
  );
}

export async function fetchLiveMatches(baseUrl, filters, setProgress) {
  const { limit, gamemode, minDurationMinutes, minPlayers } = filters;

  const params = new URLSearchParams({
    limit: String(limit),
    orderBy: "start_time",
    orderByDir: "desc",
    ranked: "true",
    processingAction: "true", // TeamStats only exist once the action log is parsed
  });
  if (gamemode) params.set("gamemode", String(gamemode));
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
    const gameID = m.id;
    const cacheKey = `bar-milestone-cache:${gameID}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      console.log(m.id, "Fetched from cache.");
      results.push(cached);
      continue;
    }

    try {
      const evJson = await getJson(
        `${baseUrl}/api/game-event/${gameID}?includeTeamStats=true`,
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
        id: gameID,
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
      await cacheSet(cacheKey, built);
      results.push(built);
    } catch (e) {
      // skip matches we fail to fetch/parse — keep the batch resilient
      continue;
    }
  }
  return results;
}
