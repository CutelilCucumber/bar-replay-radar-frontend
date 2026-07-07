import { useState, useEffect, useMemo } from "react";

/* ------------------------------------------------------------------ */
/*  Gex — Front Page concept                                          */
/*  Built for github.com/Varunda/gex issue: "Better front page"       */
/*  Live data straight from the public API, no backend changes.       */
/* ------------------------------------------------------------------ */

const API = "https://gex.honu.pw/api";

const GAMEMODES = {
  0: "Unknown", 1: "Duel", 2: "Small Team", 3: "Large Team", 4: "FFA", 5: "Team FFA",
};
const GM_ORDER = [1, 2, 3, 5, 4, 0];

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const body = await res.json();
  return body.data ?? body;
}

async function fetchLast24hMatches(onProgress) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let offset = 0;
  const limit = 100;
  const all = [];
  for (let page = 0; page < 15; page++) {
    const params = new URLSearchParams({
      startTimeAfter: since,
      offset: String(offset),
      limit: String(limit),
      orderBy: "start_time",
      orderByDir: "desc",
    });
    const batch = await getJson(`${API}/match/search?${params.toString()}`);
    all.push(...batch);
    onProgress?.(all.length);
    if (batch.length < limit) break;
    offset += limit;
  }
  return all;
}

function Bar({ pct, color }) {
  return (
    <div className="barTrack">
      <div className="barFill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function LeaderboardPanel() {
  const [entries, setEntries] = useState(null);
  const [tab, setTab] = useState(1);
  const [err, setErr] = useState(null);

  useEffect(() => {
    getJson(`${API}/leaderboard/skill?count=10`).then(setEntries).catch((e) => setErr(String(e)));
  }, []);

  const byMode = useMemo(() => {
    const m = new Map();
    for (const e of entries ?? []) {
      const arr = m.get(e.Gamemode) ?? [];
      arr.push(e);
      m.set(e.Gamemode, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => b.Skill - a.Skill);
    return m;
  }, [entries]);

  const modes = [...byMode.keys()].sort((a, b) => GM_ORDER.indexOf(a) - GM_ORDER.indexOf(b));

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Leaderboard</h2>
        <span className="panel-sub">top rated · current season</span>
      </div>
      {err && <div className="err">{err}</div>}
      {!entries && !err && <div className="loading">loading…</div>}
      {entries && (
        <>
          <div className="tabs">
            {modes.map((g) => (
              <button key={g} className={"tab" + (tab === g ? " active" : "")} onClick={() => setTab(g)}>
                {GAMEMODES[g] ?? g}
              </button>
            ))}
          </div>
          <div className="lb-list">
            {(byMode.get(tab) ?? []).map((e, i) => (
              <div className="lb-row" key={e.UserID}>
                <span className="lb-rank">{i + 1}</span>
                <span className="lb-name">{e.Username}</span>
                <span className="lb-skill">{e.Skill.toFixed(1)}</span>
              </div>
            ))}
            {(byMode.get(tab) ?? []).length === 0 && <div className="loading">no data for this mode</div>}
          </div>
        </>
      )}
    </div>
  );
}

function MapsPanel({ matches }) {
  const counts = useMemo(() => {
    const m = new Map();
    for (const match of matches) {
      const name = match.Map || match.MapName || "unknown";
      m.set(name, (m.get(name) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [matches]);

  const max = counts[0]?.[1] ?? 1;

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Maps · last 24h</h2>
        <span className="panel-sub">{matches.length} games scanned</span>
      </div>
      <div className="map-list">
        {counts.map(([name, count]) => (
          <div className="map-row" key={name}>
            <span className="map-name" title={name}>{name}</span>
            <Bar pct={(count / max) * 100} color="var(--cyan)" />
            <span className="map-count">{count}</span>
          </div>
        ))}
        {counts.length === 0 && <div className="loading">no games in the last 24h</div>}
      </div>
    </div>
  );
}

function DurationPanel({ matches }) {
  const stats = useMemo(() => {
    const byMode = new Map();
    for (const m of matches) {
      const arr = byMode.get(m.Gamemode) ?? [];
      arr.push(m.DurationMs / 60000);
      byMode.set(m.Gamemode, arr);
    }
    const rows = [];
    for (const [g, arr] of byMode.entries()) {
      arr.sort((a, b) => a - b);
      const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
      const median = arr[Math.floor(arr.length / 2)];
      rows.push({ g, avg, median, n: arr.length });
    }
    return rows.sort((a, b) => GM_ORDER.indexOf(a.g) - GM_ORDER.indexOf(b.g));
  }, [matches]);

  const maxAvg = Math.max(1, ...stats.map((s) => s.avg));

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Duration by gamemode</h2>
        <span className="panel-sub">avg / median, last 24h</span>
      </div>
      <div className="dur-list">
        {stats.map((s) => (
          <div className="dur-row" key={s.g}>
            <span className="dur-name">{GAMEMODES[s.g] ?? s.g}</span>
            <Bar pct={(s.avg / maxAvg) * 100} color="var(--amber)" />
            <span className="dur-vals">{s.avg.toFixed(0)}m avg · {s.median.toFixed(0)}m med · {s.n}g</span>
          </div>
        ))}
        {stats.length === 0 && <div className="loading">no games in the last 24h</div>}
      </div>
    </div>
  );
}

function OsDistributionPanel({ matches }) {
  const { bins, binWidth } = useMemo(() => {
    const latestSkillByUser = new Map();
    for (const m of matches) {
      for (const p of m.Players ?? []) {
        latestSkillByUser.set(p.UserID, p.Skill ?? 0);
      }
    }
    const skills = [...latestSkillByUser.values()];
    if (skills.length === 0) return { bins: [], binWidth: 5 };
    const width = 5;
    const min = Math.floor(Math.min(...skills) / width) * width;
    const max = Math.ceil(Math.max(...skills) / width) * width;
    const bucket = new Map();
    for (let b = min; b < max; b += width) bucket.set(b, 0);
    for (const s of skills) {
      const b = Math.floor(s / width) * width;
      bucket.set(b, (bucket.get(b) ?? 0) + 1);
    }
    return { bins: [...bucket.entries()], binWidth: width };
  }, [matches]);

  const max = Math.max(1, ...bins.map(([, c]) => c));

  return (
    <div className="panel wide">
      <div className="panel-head">
        <h2>OS distribution</h2>
        <span className="panel-sub">unique players seen in the last 24h, {bins.reduce((a, [, c]) => a + c, 0)} total</span>
      </div>
      <div className="hist">
        {bins.map(([b, c]) => (
          <div className="hist-col" key={b} title={`${b}–${b + binWidth}: ${c} players`}>
            <div className="hist-bar" style={{ height: `${(c / max) * 100}%` }} />
            <span className="hist-label">{b}</span>
          </div>
        ))}
        {bins.length === 0 && <div className="loading">no data</div>}
      </div>
    </div>
  );
}

export default function App() {
  const [matches, setMatches] = useState(null);
  const [count, setCount] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchLast24hMatches(setCount)
      .then(setMatches)
      .catch((e) => setError(String(e.message || e)));
  }, []);

  return (
    <div className="wrap">
      <style>{`
        .wrap {
          --bg:#14171a; --panel:#1b1f23; --panel2:#20252a; --grid:#2a3138;
          --text:#e8eaed; --dim:#8a9199; --amber:#ffab3d; --cyan:#4fd1c5; --red:#e5484d;
          background: var(--bg); color: var(--text); font-family:'Inter',system-ui,sans-serif;
          padding: 26px 20px 50px; min-height:100%;
        }
        .wrap * { box-sizing: border-box; }
        .hdr h1 {
          font-family:'Oswald','Arial Narrow',sans-serif; font-weight:600; text-transform:uppercase;
          letter-spacing:.03em; font-size:24px; margin:0 0 2px;
        }
        .hdr .sub { color: var(--dim); font-size:12.5px; }
        .rule { height:1px; background: var(--grid); margin:14px 0 20px; }
        .status { font-family:'JetBrains Mono',monospace; font-size:11.5px; color: var(--dim); margin-bottom:16px; }
        .err { color: var(--red); font-size:12px; }

        .board { display:grid; grid-template-columns: 1.1fr 1fr 1fr; gap:14px; }
        .board .wide { grid-column: 1 / -1; }
        @media (max-width: 900px) { .board { grid-template-columns: 1fr; } }

        .panel { background: var(--panel); border:1px solid var(--grid); border-radius:6px; padding:14px; position:relative; }
        .panel::before { content:''; position:absolute; top:0; left:0; width:12px; height:12px; border-top:2px solid var(--dim); border-left:2px solid var(--dim); opacity:.35; }
        .panel-head { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:10px; flex-wrap:wrap; gap:4px; }
        .panel-head h2 { font-size:13px; text-transform:uppercase; letter-spacing:.05em; margin:0; font-family:'Oswald',sans-serif; font-weight:600; }
        .panel-sub { font-size:10.5px; color: var(--dim); }
        .loading { color: var(--dim); font-size:12px; padding:10px 0; }

        .tabs { display:flex; gap:4px; flex-wrap:wrap; margin-bottom:10px; }
        .tab { background: var(--panel2); border:1px solid var(--grid); color: var(--dim); font-size:10.5px;
          padding:4px 8px; border-radius:3px; cursor:pointer; text-transform:uppercase; letter-spacing:.03em; }
        .tab.active { color: var(--cyan); border-color: var(--cyan); }
        .lb-row { display:flex; align-items:center; gap:8px; font-size:12.5px; padding:3px 0; border-bottom:1px solid var(--grid); }
        .lb-row:last-child { border-bottom:none; }
        .lb-rank { width:18px; color: var(--dim); font-family:'JetBrains Mono',monospace; font-size:11px; }
        .lb-name { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .lb-skill { font-family:'JetBrains Mono',monospace; color: var(--cyan); font-size:12px; }

        .map-row, .dur-row { display:flex; align-items:center; gap:8px; font-size:11.5px; padding:3px 0; }
        .map-name, .dur-name { width:88px; flex-shrink:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color: var(--dim); }
        .map-count, .dur-vals { flex-shrink:0; font-family:'JetBrains Mono',monospace; font-size:10.5px; color: var(--text); width:120px; text-align:right; }
        .barTrack { flex:1; height:8px; background: var(--panel2); border-radius:2px; overflow:hidden; }
        .barFill { height:100%; }

        .hist { display:flex; align-items:flex-end; gap:3px; height:120px; padding-top:10px; }
        .hist-col { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; height:100%; gap:4px; }
        .hist-bar { width:100%; background: var(--amber); border-radius:2px 2px 0 0; min-height:2px; }
        .hist-label { font-size:8.5px; color: var(--dim); font-family:'JetBrains Mono',monospace; transform: rotate(-40deg); transform-origin: top left; white-space:nowrap; }
      `}</style>

      <div className="hdr">
        <h1>▲ gex — front page concept</h1>
        <span className="sub">prototype for "Better front page" — leaderboard, OS distribution, maps &amp; durations, all live off the public API</span>
      </div>
      <div className="rule" />

      {!matches && !error && <div className="status">pulling last 24h of matches… {count} fetched so far</div>}
      {error && <div className="err">failed to load recent matches: {error}</div>}

      <div className="board">
        <LeaderboardPanel />
        <MapsPanel matches={matches ?? []} />
        <DurationPanel matches={matches ?? []} />
        <OsDistributionPanel matches={matches ?? []} />
      </div>
    </div>
  );2
}
