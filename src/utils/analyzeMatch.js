//ideas for metrics
//heavily one-sided to reduce points
//apm for action packed games
//unit type diversity (bots, veh, air, sea, hov, amphib) weighted less for large games, some units worth more
//momentum shifts between teams army value
//sharp declines in army value for both team (rework big battles)
//1 commander left on winning team (rework close finish)
//winning team once far behind on army value (rework comeback)
//combat efficiency - damage per metal spent
//afus rush - afus before 20 mins (maybe depends on wind speed)

export function analyzeMatch(match) {
  const { series, winner, teamA, teamB, durationMin } = match;
  const last = series[series.length - 1];
  const winnerIsA = winner === "A";

  // --- comeback: how far behind (in eco share) was the winner at their worst point? ---
  let worstDeficit = 0;
  for (const p of series) {
    const winnerShare = winnerIsA ? p.leadPct : 1 - p.leadPct;
    const deficit = 0.5 - winnerShare;
    if (deficit > worstDeficit) worstDeficit = deficit;
  }
  const comeback = worstDeficit >= 0.13; // winner was ever down >13pts of eco share
  const comebackMagnitude = Math.min(1, worstDeficit / 0.35);

  // --- close finish: final eco share within 6pts, and a real game (12+ min) ---
  const finalGap = Math.abs(last.leadPct - 0.5);
  const closeFinish = finalGap <= 0.06 && durationMin >= 12;
  const closeMagnitude = closeFinish ? 1 - finalGap / 0.06 : 0;

  // --- big battle: largest single-interval combined damage jump vs. the average jump ---
  let maxJump = 0,
    jumps = [],
    maxJumpAt = null;
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1],
      cur = series[i];
    const dmgJump = cur.dmgA - prev.dmgA + (cur.dmgB - prev.dmgB);
    jumps.push(dmgJump);
    if (dmgJump > maxJump) {
      maxJump = dmgJump;
      maxJumpAt = cur.t;
    }
  }
  const avgJump = jumps.reduce((a, b) => a + b, 0) / Math.max(1, jumps.length);
  const battleRatio = avgJump > 0 ? maxJump / avgJump : 0;
  const bigBattle = battleRatio >= 2.6 && maxJump > 200;
  const battleMagnitude = Math.min(1, (battleRatio - 2.6) / 3);

  // --- upset: meaningful skill gap, lower-skill side won ---
  const skillGap = Math.abs(teamA.skill - teamB.skill);
  const lowerSkillTeam = teamA.skill < teamB.skill ? "A" : "B";
  const upset = skillGap >= 5 && winner === lowerSkillTeam;
  const upsetMagnitude = Math.min(1, skillGap / 15);

  // --- fast start / eco race: strong divergence inside the first 20% of the game ---
  const earlyCutoff = durationMin * 0.2;
  const earlyPoint =
    series.find((p) => p.t >= earlyCutoff) || series[1] || last;
  const earlyGap = Math.abs(earlyPoint.leadPct - 0.5);
  const ecoRace = earlyGap >= 0.18;
  const ecoRaceMagnitude = Math.min(1, earlyGap / 0.35);

  const flags = { comeback, closeFinish, bigBattle, upset, ecoRace };
  const magnitudes = {
    comeback: comebackMagnitude,
    closeFinish: closeMagnitude,
    bigBattle: battleMagnitude,
    upset: upsetMagnitude,
    ecoRace: ecoRaceMagnitude,
  };

  // weighted spectate score, 0-100
  const weights = {
    comeback: 34,
    closeFinish: 26,
    bigBattle: 22,
    upset: 30,
    ecoRace: 6,
  };
  let score = 0;
  for (const k of Object.keys(weights)) {
    if (flags[k]) score += weights[k] * (0.5 + 0.5 * magnitudes[k]);
  }
  // sweet-spot duration bonus (most watchable games run 15-40 min)
  if (durationMin >= 15 && durationMin <= 40) score += 6;
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    flags,
    magnitudes,
    score,
    maxJumpAt,
    worstDeficit,
    finalGap,
    skillGap,
  };
}
