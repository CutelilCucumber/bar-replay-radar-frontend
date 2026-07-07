import { frameToClock } from "./FmtClock.jsx";

export default function analyzeMatch(match, teamStats) {
    console.log("Analyzing: ", match, teamStats);
  const teamToAlly = new Map();
  const skillByAlly = new Map();
  for (const p of match.Players ?? []) {
    teamToAlly.set(p.TeamID, p.AllyTeamID);
    const arr = skillByAlly.get(p.AllyTeamID) ?? [];
    arr.push(p.Skill ?? 0);
    skillByAlly.set(p.AllyTeamID, arr);
  }

  const allyIds = [...new Set((match.AllyTeams ?? []).map((a) => a.AllyTeamID))];
  if (allyIds.length !== 2) return null; // only score clean 1-side-vs-1-side games for now

  const winner = (match.AllyTeams ?? []).find((a) => a.Won)?.AllyTeamID;
  if (winner === undefined) return null;
  const loser = allyIds.find((a) => a !== winner);

  // frame -> allyTeamID -> aggregated cumulative stats
  const byFrame = new Map();
  for (const row of teamStats) {
    const ally = teamToAlly.get(row.TeamID);
    if (ally === undefined) continue;
    if (!byFrame.has(row.Frame)) byFrame.set(row.Frame, new Map());
    const frameMap = byFrame.get(row.Frame);
    const cur = frameMap.get(ally) ?? { metal: 0, dmgDealt: 0, dmgRecv: 0, kills: 0 };
    cur.metal += Number(row.MetalProduced ?? 0);
    cur.dmgDealt += Number(row.DamageDealt ?? 0);
    cur.dmgRecv += Number(row.DamageReceived ?? 0);
    cur.kills += Number(row.UnitsKilled ?? 0);
    frameMap.set(ally, cur);
  }

  const frames = [...byFrame.keys()].sort((a, b) => a - b);
  if (frames.length < 3) return null;

  let maxDeficitPct = 0;
  let deficitFrame = 0;
  let maxDps = 0;
  let dpsFrame = 0;
  const series = [];

  let prevTotalDmg = 0;
  let prevFrame = frames[0];

  for (const f of frames) {
    const m = byFrame.get(f);
    const win = m.get(winner) ?? { metal: 0, dmgDealt: 0, dmgRecv: 0, kills: 0 };
    const lose = m.get(loser) ?? { metal: 0, dmgDealt: 0, dmgRecv: 0, kills: 0 };
    const total = win.metal + lose.metal;
    const winShare = total > 0 ? win.metal / total : 0.5;
    series.push({ frame: f, winShare });

    // winner behind economically at this point?
    if (lose.metal > win.metal && lose.metal > 0) {
      const deficit = ((lose.metal - win.metal) / lose.metal) * 100;
      if (deficit > maxDeficitPct) {
        maxDeficitPct = deficit;
        deficitFrame = f;
      }
    }

    const totalDmg = win.dmgDealt + lose.dmgDealt;
    const dt = (f - prevFrame) / FRAME_RATE;
    if (dt > 0) {
      const dps = (totalDmg - prevTotalDmg) / dt;
      if (dps > maxDps) {
        maxDps = dps;
        dpsFrame = f;
      }
    }
    prevTotalDmg = totalDmg;
    prevFrame = f;
  }

  const last = byFrame.get(frames[frames.length - 1]);
  const winFinal = last.get(winner) ?? { dmgDealt: 0, kills: 0 };
  const loseFinal = last.get(loser) ?? { dmgDealt: 0, kills: 0 };
  const killRatio =
    Math.max(winFinal.kills, loseFinal.kills) > 0
      ? Math.min(winFinal.kills, loseFinal.kills) / Math.max(winFinal.kills, loseFinal.kills)
      : 0;

  const avgSkill = (allyId) => {
    const arr = skillByAlly.get(allyId) ?? [0];
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  };
  const skillGap = avgSkill(loser) - avgSkill(winner); // positive => winner was the underdog

  const durationMin = match.DurationMs / 60000;

  const badges = [];
  let score = 20;

  // comeback: winner was significantly behind in economy, and not right at the start
  const comebackLate = deficitFrame / FRAME_RATE / 60 > 3; // after the 3 min mark
  if (maxDeficitPct > 20 && comebackLate) {
    badges.push("comeback");
    score += Math.min(35, maxDeficitPct * 0.9);
  }

  // big battle: damage-per-second spike relative to game length
  const dpsScore = Math.min(25, maxDps / 400);
  if (maxDps > 3000) {
    badges.push("battle");
    score += dpsScore;
  }

  // nailbiter: kills close to even at the end, longish game
  if (killRatio > 0.75 && durationMin > 12) {
    badges.push("nailbiter");
    score += 20;
  }

  // upset: underdog (lower skill) won
  if (skillGap > 3) {
    badges.push("upset");
    score += Math.min(20, skillGap * 2);
  }

  if (badges.length === 0 && durationMin > 15) {
    score += 5; // long clean game, mild credit
  }
  if (killRatio < 0.15 && durationMin < 8) {
    badges.push("stomp");
    score -= 10;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score,
    badges,
    series,
    maxDeficitPct: Math.round(maxDeficitPct),
    deficitClock: frameToClock(deficitFrame),
    maxDps: Math.round(maxDps),
    dpsClock: frameToClock(dpsFrame),
    killRatio,
    skillGap: Math.round(skillGap * 10) / 10,
    winnerAllyId: winner,
  };
}