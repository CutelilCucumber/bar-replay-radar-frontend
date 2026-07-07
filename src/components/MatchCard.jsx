import { fmtClock } from "../utils/FmtClock.jsx";
import sparkline from "./Sparkline.jsx";

const GAMEMODES = {
  0: "Unknown", 1: "Duel", 2: "Small Team", 3: "Large Team", 4: "FFA", 5: "Team FFA",
};

const badgeMeta = {
  comeback: { label: "COMEBACK", color: "var(--amber)" },
  battle: { label: "BIG BATTLE", color: "var(--red)" },
  nailbiter: { label: "NAIL-BITER", color: "var(--cyan)" },
  upset: { label: "UPSET", color: "var(--violet)" },
  stomp: { label: "ONE-SIDED", color: "var(--dim)" },
};

export default function MatchCard({ m, analysis }) {
    console.log("MatchCard", m, analysis);
  const players = m.Players ?? [];
  const byAlly = new Map();
  for (const p of players) {
    const arr = byAlly.get(p.AllyTeamID) ?? [];
    arr.push(p);
    byAlly.set(p.AllyTeamID, arr);
  }
  const allyTeams = m.AllyTeams ?? [];

  return (
    <div className="card">
      <div className="card-top">
        <div className="score" style={{ "--s": analysis ? analysis.score : 0 }}>
          <span>{analysis ? analysis.score : "—"}</span>
        </div>
        <div className="meta">
          <div className="meta-row">
            <span className="map">{m.Map || m.MapName}</span>
            <span className="dot">·</span>
            <span>{GAMEMODES[m.Gamemode] ?? "?"}</span>
            <span className="dot">·</span>
            <span>{fmtClock(m.DurationMs)}</span>
            <span className="dot">·</span>
            <span>{m.PlayerCount}p</span>
          </div>
          <div className="badges">
            {(analysis?.badges ?? []).map((b) => (
              <span key={b} className="badge" style={{ "--c": badgeMeta[b].color }}>
                {badgeMeta[b].label}
              </span>
            ))}
            {!analysis && <span className="badge dim">NOT SCORED (needs 2 sides)</span>}
          </div>
        </div>
        {analysis && <Sparkline series={analysis.series} winnerAllyId={analysis.winnerAllyId} />}
      </div>

      <div className="rosters">
        {allyTeams.map((at) => (
          <div className="roster" key={at.AllyTeamID}>
            <div className={"roster-head" + (at.Won ? " won" : "")}>
              {at.Won ? "WON" : "LOST"}
            </div>
            {(byAlly.get(at.AllyTeamID) ?? []).map((p) => (
              <div className="player" key={p.PlayerID}>
                <span className="pname">{p.Name}</span>
                <span className="pskill">{Math.round(p.Skill)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {analysis && (
        <div className="facts">
          {analysis.badges.includes("comeback") && (
            <span>economy was down {analysis.maxDeficitPct}% at {analysis.deficitClock}, won anyway</span>
          )}
          {analysis.badges.includes("battle") && (
            <span>peak combat ~{analysis.maxDps.toLocaleString()} dmg/s around {analysis.dpsClock}</span>
          )}
          {analysis.badges.includes("nailbiter") && (
            <span>kill counts within {Math.round(analysis.killRatio * 100)}% of each other at the end</span>
          )}
          {analysis.badges.includes("upset") && (
            <span>winner averaged {analysis.skillGap} lower skill rating than the loser</span>
          )}
        </div>
      )}

      <a className="open" href={`https://gex.honu.pw/match/${m.ID}`} target="_blank" rel="noreferrer">
        open replay on gex →
      </a>
    </div>
  );
}