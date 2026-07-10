import { FRAMES_PER_SECOND, CUMULATIVE } from "./globalVars.js";

/**
 * Builds a time-series data structure from game economy and damage statistics.
 * @param {Array} points - Array of data points in format [minute, ecoA, ecoB, dmgA, dmgB]
 * @returns {Array} Array of objects with time-series data including calculated lead percentage
 */
function buildSeries(points) {
  // points: [ [minute, ecoA, ecoB, dmgA, dmgB], ... ] -> fills a clean series
  return points.map(([t, ecoA, ecoB, dmgA, dmgB]) => ({
    t, // Time in minutes
    ecoA, // Economy value for team A at time t
    ecoB, // Economy value for team B at time t
    dmgA, // Damage dealt by team A up to time t
    dmgB, // Damage dealt by team B up to time t
    leadPct: ecoA + ecoB === 0 ? 0.5 : ecoA / (ecoA + ecoB), // Percentage of economy controlled by team A (0.5 = equal)
  }));
}

export function bucketFrameStatsToSeries(
  teamStats,
  players,
  allyTeams,
  durationMin,
) {
  /**
   * Converts per-frame team statistics into time-bucketed series data.
   *
   * @param {Array} teamStats - GameEventTeamStats[] containing per-frame stats like metalProduced, energyProduced, damageDealt
   * @param {Array} players - BarMatchPlayer[] used to map teamID to allyTeamID
   * @param {Array} allyTeams - Array of ally team objects
   * @param {number} durationMin - Total duration of the game in minutes
   * @returns {Array} Time-series data in format [{t, ecoA, ecoB, dmgA, dmgB, leadPct}, ...]
   */

  // Create a mapping from teamID to allyTeamID for quick lookup
  const teamToAlly = {};
  for (const p of players) teamToAlly[p.teamID] = p.allyTeamID;

  // Extract and sort unique ally team IDs (for 1v1, this will be [1, 2]; extend for FFA if needed)
  const allyIds = [...new Set(allyTeams.map((a) => a.allyTeamID))].sort(
    (a, b) => a - b,
  );
  const [allyA, allyB] = allyIds; // Destructure to get the two team IDs (1v1)

  // Create a map to store aggregated stats per minute
  const buckets = new Map(); // minute -> { ecoA, ecoB, dmgA, dmgB, seenA, seenB }
  const bucketSize = 60 * FRAMES_PER_SECOND; // Number of frames in one minute (60 seconds * FPS)

  // Process each team stat entry
  for (const row of teamStats) {
    const teamID = row.teamID;
    const ally = teamToAlly[teamID];
    if (ally == null) continue; // Skip if teamID not found in mapping

    const frame = row.frame;
    const minute = Math.floor(frame / bucketSize); // Calculate minute bucket for this frame

    // Calculate economy: metalProduced + energyProduced/60 (convert energy to equivalent metal)
    const eco =
      Number(row.metalProduced ?? 0) + Number(row.energyProduced ?? 0) / 60;
    const dmg = Number(row.damageDealt ?? 0); // Total damage dealt by this team

    // Get or initialize bucket for this minute
    const b = buckets.get(minute) || {
      ecoA: 0,
      ecoB: 0,
      dmgA: 0,
      dmgB: 0,
      seenA: false,
      seenB: false,
    };

    // Add stats to the appropriate team's bucket
    if (ally === allyA) {
      // Team A stats
      b.ecoA = CUMULATIVE ? Math.max(b.ecoA, eco) : b.ecoA + eco; // CUMULATIVE: track max eco; else: sum eco
      b.dmgA = CUMULATIVE ? Math.max(b.dmgA, dmg) : b.dmgA + dmg; // CUMULATIVE: track max dmg; else: sum dmg
    }
    if (ally === allyB) {
      // Team B stats
      b.ecoB = CUMULATIVE ? Math.max(b.ecoB, eco) : b.ecoB + eco;
      b.dmgB = CUMULATIVE ? Math.max(b.dmgB, dmg) : b.dmgB + dmg;
    }
    buckets.set(minute, b); // Store updated bucket
  }

  // Sort minutes in ascending order
  const minutes = [...buckets.keys()].sort((a, b) => a - b);

  // Convert buckets to the series format expected by buildSeries
  return buildSeries(
    minutes.map((t) => {
      const b = buckets.get(t);
      return [t, b.ecoA, b.ecoB, b.dmgA, b.dmgB]; // Format: [minute, ecoA, ecoB, dmgA, dmgB]
    }),
  );
}
