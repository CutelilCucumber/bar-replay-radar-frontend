import { useState, useRef, useCallback } from "react";
import getJson from "./utils/api.js";
import analyzeMatch from "./utils/analyzeMatch.js";
import MatchCard from "./components/MatchCard.jsx";

const API = "https://gex.honu.pw/api";
const FRAME_RATE = 30; // BAR/Recoil sim frames per second

export default function App() {
  const [gamemode, setGamemode] = useState("");
  const [minDuration, setMinDuration] = useState(10);
  const [minPlayers, setMinPlayers] = useState(1);
  const [scanDepth, setScanDepth] = useState(30);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const cancelRef = useRef(false);

  const runScan = useCallback(async () => {
    setRunning(true);
    setError(null);
    setResults([]);
    cancelRef.current = false;

    try {
      const params = new URLSearchParams({
        offset: "0",
        limit: String(Math.min(100, scanDepth)),
        orderBy: "start_time",
        orderByDir: "desc",
        durationMinimum: String(minDuration * 60 * 1000),
        playerCountMinimum: String(minPlayers),
        processingAction: "true",
      });
      if (gamemode) params.set("gamemode", gamemode);

      const matches = await getJson(`${API}/match/search?${params.toString()}`);
      setProgress({ done: 0, total: matches.length });

      const scored = [];
      const CONCURRENCY = 1;
      let idx = 0;

      async function worker() {
        while (idx < matches.length && !cancelRef.current) {
          const i = idx++;
          const m = matches[i];
          try {
            let analysis = null;
            const cacheKey = `bar-spectate-score:${m.id}`;
            let cached = null;
            try {
              const stored = await window.storage.get(cacheKey, true);
              cached = stored ? JSON.parse(stored.value) : null;
            } catch {
              /* no cache entry yet */
            }

            if (cached) {
              console.log("pulling from cache");
              analysis = cached;
            } else {
              console.log("fetching from API");
              const events = await getJson(
                `${API}/game-event/${m.id}?includeTeamStats=true`,
              );
              console.log("match: ", m);
              console.log("events: ", events);
              try {
                analysis = analyzeMatch(m, events.teamStats ?? []);
              } catch (e) {
                console.error("analyzeMatch failed: ", e);
                analysis = null;
              }
              console.log("analysis: ", analysis);
              try {
                await window.storage.set(
                  cacheKey,
                  JSON.stringify(analysis),
                  true,
                );
              } catch {
                /* best effort cache */
              }
            }
            scored.push({ m, analysis });
          } catch (e) {
            scored.push({ m, analysis: null });
          }
          setProgress((p) => ({ ...p, done: p.done + 1 }));
        }
      }

      await Promise.all(Array.from({ length: CONCURRENCY }, worker));

      scored.sort(
        (a, b) => (b.analysis?.score ?? -1) - (a.analysis?.score ?? -1),
      );
      setResults(scored);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setRunning(false);
    }
  }, [gamemode, minDuration, minPlayers, scanDepth]);

  return (
    <div className="wrap">
      <div className="hdr">
        <h1>▲ Spectator Finder</h1>
        <span className="sub">
          live scan of gex.honu.pw · Beyond All Reason replay data
        </span>
      </div>
      <div className="rule" />

      <div className="controls">
        <div className="field">
          <label>Gamemode</label>
          <select
            value={gamemode}
            onChange={(e) => setGamemode(e.target.value)}
          >
            <option value="">Any</option>
            <option value="1">Duel</option>
            <option value="2">Small Team</option>
            <option value="3">Large Team</option>
            <option value="4">FFA</option>
            <option value="5">Team FFA</option>
          </select>
        </div>
        <div className="field">
          <label>Min duration (min)</label>
          <input
            type="number"
            min="0"
            value={minDuration}
            onChange={(e) => setMinDuration(+e.target.value)}
          />
        </div>
        <div className="field">
          <label>Min players (exclusive)</label>
          <input
            type="number"
            min="2"
            value={minPlayers}
            onChange={(e) => setMinPlayers(+e.target.value)}
          />
        </div>
        <div className="field">
          <label>Matches to scan</label>
          <select
            value={scanDepth}
            onChange={(e) => setScanDepth(+e.target.value)}
          >
            <option value={1}>1</option>
            <option value={10}>10</option>
            <option value={30}>30</option>
            <option value={60}>60</option>
            <option value={100}>100</option>
          </select>
        </div>
        <button className="run-btn" disabled={running} onClick={runScan}>
          {running ? "Scanning…" : "Run scan"}
        </button>
      </div>

      {running && (
        <div className="progress">
          fetched {progress.done} / {progress.total} matches
          <div className="bar">
            <div
              className="bar-fill"
              style={{
                width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}
      {error && <div className="error">scan failed: {error}</div>}

      {!running && results.length === 0 && !error && (
        <div className="empty">
          set your filters and run a scan — recent ranked matches will be pulled
          and scored for comebacks, big fights, close finishes, and upsets.
        </div>
      )}

      <div className="grid">
        {results.map(({ m, analysis }) => (
          <MatchCard key={m.id} m={m} analysis={analysis} />
        ))}
      </div>
    </div>
  );
}
