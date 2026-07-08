import { frameToClock } from "./fmtClock.js";

export default function analyzeMatch(match, teamStats) {
  
  const FRAME_RATE = 30; // BAR/Recoil sim frames per second

  // build lookup table
  const teamToAlly = new Map();
  const skillByAlly = new Map();
  for (const p of match.players ?? []) {
    teamToAlly.set(p.teamID, p.allyTeamID);
    const arr = skillByAlly.get(p.allyTeamID) ?? [];
    arr.push(p.Skill ?? 0);
    skillByAlly.set(p.allyTeamID, arr);
  }

  // only score 2 team games for now
  const allyIds = [...new Set((match.allyTeams ?? []).map((a) => a.allyTeamID))];
  if (allyIds.length !== 2) {
    console.log("not a 2-team game, skipping scoring");
    return null;
  }

  const winner = (match.allyTeams ?? []).find((a) => a.won)?.allyTeamID;
  if (winner === undefined) {
    console.log("no winner found, skipping scoring");
    return null;
  }
  const loser = allyIds.find((a) => a !== winner);

  // frame -> allyTeamID -> aggregated cumulative stats
  const byFrame = new Map();
  for (const row of teamStats) {
    const ally = teamToAlly.get(row.teamID);
    //drop any stats for players not in the match (e.g. spectators)
    if (ally === undefined) continue; 
    if (!byFrame.has(row.frame)) byFrame.set(row.frame, new Map());
    const frameMap = byFrame.get(row.frame);
    const cur = frameMap.get(ally) ?? { metal: 0, dmgDealt: 0, dmgRecv: 0, kills: 0 };
    // aggregate cumulative stats for this ally team at this frame
    cur.metal += Number(row.MetalProduced ?? 0);
    cur.dmgDealt += Number(row.DamageDealt ?? 0);
    cur.dmgRecv += Number(row.DamageReceived ?? 0);
    cur.kills += Number(row.UnitsKilled ?? 0);
    frameMap.set(ally, cur);
  }

  const frames = [...byFrame.keys()].sort((a, b) => a - b);
  // exclude very short games
  if (frames.length < 3) {
    console.log("game too short, skipping scoring");
    return null;
  }

  // compute comeback
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
  // positive => winner was the underdog
  const skillGap = avgSkill(loser) - avgSkill(winner); 

  const durationMin = match.durationMs / 60000;

  const badges = [];
  let score = 20;

  // comeback: winner was significantly behind in economy, and not right at the start
  const comebackLate = deficitFrame / FRAME_RATE / 60 > 5; // after the 5 min mark
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
  if (killRatio > 0.75 && durationMin > 20) {
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