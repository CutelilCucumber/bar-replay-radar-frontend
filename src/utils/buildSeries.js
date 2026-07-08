import { FRAMES_PER_SECOND, CUMULATIVE } from "./globalVars.js";

export function buildSeries(points) {
  // points: [ [minute, ecoA, ecoB, dmgA, dmgB], ... ] -> fills a clean series
  return points.map(([t, ecoA, ecoB, dmgA, dmgB]) => ({
    t,
    ecoA,
    ecoB,
    dmgA,
    dmgB,
    leadPct: ecoA + ecoB === 0 ? 0.5 : ecoA / (ecoA + ecoB),
  }));
}

export function bucketFrameStatsToSeries(
  teamStats,
  players,
  allyTeams,
  durationMin,
) {
  // teamStats: GameEventTeamStats[] with {teamID, frame, metalProduced, energyProduced, damageDealt,...}
  // players: BarMatchPlayer[] to map teamID -> allyTeamID
  const teamToAlly = {};
  for (const p of players) teamToAlly[p.teamID] = p.allyTeamID;

  const allyIds = [...new Set(allyTeams.map((a) => a.allyTeamID))].sort(
    (a, b) => a - b,
  );
  const [allyA, allyB] = allyIds; // 1v1 ally-team framing; extend for FFA if needed

  const buckets = new Map(); // minute -> { ecoA, ecoB, dmgA, dmgB }
  const bucketSize = 60 * FRAMES_PER_SECOND;

  for (const row of teamStats) {
    const teamID = row.teamID;
    const ally = teamToAlly[teamID];
    if (ally == null) continue;
    const frame = row.frame;
    const minute = Math.floor(frame / bucketSize);
    const eco =
      Number(row.metalProduced ?? 0) + Number(row.energyProduced ?? 0) / 60;
    const dmg = Number(row.damageDealt ?? 0);

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
