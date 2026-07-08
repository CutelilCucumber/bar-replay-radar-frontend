import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceDot,
  ResponsiveContainer,
} from "recharts";
import {
  AlertTriangle,
  Loader2,
  RefreshCw,
  Settings2,
  Flame,
} from "lucide-react";
import { MatchCard } from "./components";
import { analyzeMatch } from "./utils/analyzeMatch.js";
import { fetchLiveMatches } from "./utils/api.js";
import {
  GEX_API_BASE,
  MILESTONES,
  COLORS,
  FONT_IMPORT,
  CUMULATIVE,
  FRAMES_PER_SECOND,
} from "./utils/globalVars.js";

/* ============================================================
   SAVED MODE: fake built matches with synthetic per-minute
   telemetry so the scoring logic is visible and tunable without
   a live connection.
 
   SCAN: queries a gex-compatible API
   (https://github.com/varunda/gex) at /api/match/recent and
   /api/game-event/{id}?includeTeamStats=true, buckets the raw
   per-frame GameEventTeamStats into per-minute team series, and
   runs the same scoring engine. Results are cached via
   window.storage so repeat visits don't re-fetch already-seen
   matches.
   ============================================================ */

export default function App() {
  const [mode, setMode] = useState("saved"); // "saved" | "scan"
  const [loadParams, setLoadParams] = useState({
    limit: 20,
    gamemode: null,
    minDurationMinutes: 5,
    minPlayers: null,
    minimumAverageOS: null,
  });
  const [saved, setSaved] = useState(true);
  const [matches, setMatches] = useState([]);
  const [newMatches, setNewMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [activeFilters, setActiveFilters] = useState(new Set());
  const [minScore, setMinScore] = useState(0);
  const [sortBy, setSortBy] = useState("score");

  useEffect(() => {
    if (mode === "saved") {
      const cachedMatches = localStorage.getItem("cachedMatches");
      if (cachedMatches) setMatches(JSON.parse(cachedMatches));
    } else {
      setMatches(newMatches);
    }
    setLoading(false);
  }, [mode, newMatches]);

  const analyses = useMemo(() => {
    const map = {};
    for (const m of matches) map[m.id] = analyzeMatch(m);
    return map;
  }, [matches]);

  const filtered = useMemo(() => {
    let list = matches.filter((m) => {
      const a = analyses[m.id];
      if (a.score < minScore) return false;
      if (
        activeFilters.size > 0 &&
        ![...activeFilters].every((f) => a.flags[f])
      )
        return false;
      return true;
    });
    list = list.slice().sort((a, b) => {
      if (sortBy === "score")
        return analyses[b.id].score - analyses[a.id].score;
      if (sortBy === "recent")
        return new Date(b.startTime) - new Date(a.startTime);
      if (sortBy === "duration") return b.durationMin - a.durationMin;
      return 0;
    });
    return list;
  }, [matches, analyses, activeFilters, minScore, sortBy]);

  const runLiveSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    setProgress("connecting…");
    try {
      const results = await fetchLiveMatches(
        GEX_API_BASE,
        loadParams,
        setProgress,
      );
      if (results.length === 0)
        setError("Connected, but no matches were found with this criteria.");
      setNewMatches(results);
    } catch (e) {
      setError(`${e.message}`);
    } finally {
      setLoading(false);
      setSaved(false);
      setProgress("");
    }
  }, [GEX_API_BASE, loadParams]);

  const toggleFilter = (key) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleSave = useCallback(async () => {
    let cachedMatches = [];
    const cache = localStorage.getItem("cachedMatches");
    if (cache) cachedMatches = JSON.parse(cache);
    const combined = [
      ...cachedMatches,
      ...matches.filter(
        (match) =>
          !cachedMatches.some(
            (cachedMatch) => cachedMatch.id === match.id, // Replace 'id' with your unique identifier
          ),
      ),
    ];

    localStorage.setItem("cachedMatches", JSON.stringify(combined));

    setSaved(true);
    setMode("saved");
  });

  return (
    <div
      style={{
        background: COLORS.bg,
        minHeight: "100%",
        color: COLORS.ink,
        fontFamily: "'Inter', sans-serif",
        padding: "8px 20px 60px",
      }}
    >
      <style>{`
        * { box-sizing: border-box;
        font-family: Space Grotesk, Inter, sans-serif; }
         }
        ::selection { background: ${COLORS.eco}33; }
        button:focus-visible, input:focus-visible, select:focus-visible {
          outline: 2px solid ${COLORS.eco}; outline-offset: 2px;
        }
      `}</style>

      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 22,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <Flame size={20} color={COLORS.combat} />
              <h1
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: 26,
                  margin: 0,
                  letterSpacing: "-0.01em",
                }}
              >
                Fire Replay Finder
              </h1>
            </div>
            <p
              style={{
                margin: "4px 0 0 29px",
                color: COLORS.muted,
                fontSize: 13.5,
              }}
            >
              scores Beyond All Reason replays for comebacks, photo finishes,
              big fights, and upsets · built on{" "}
              <span style={{ color: COLORS.ink }}>gex</span>
            </p>
          </div>
          <div
            style={{
              display: "flex",
              background: COLORS.panel,
              border: `1px solid ${COLORS.line}`,
              borderRadius: 8,
              padding: 3,
            }}
          >
            {["saved", "scan"].map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  padding: "6px 14px",
                  borderRadius: 6,
                  fontSize: 12.5,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 600,
                  letterSpacing: "0.03em",
                  background: mode === m ? COLORS.eco : "transparent",
                  color: mode === m ? COLORS.bg : COLORS.muted,
                }}
              >
                {m.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* live controls */}
        {mode === "scan" && (
          <div
            style={{
              background: COLORS.panel,
              border: `1px solid ${COLORS.line}`,
              borderRadius: 10,
              padding: 14,
              marginBottom: 18,
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <Settings2 size={15} color={COLORS.muted} />
            <label>
              Gamemode:
              <select
                value={loadParams.gamemode ?? ""}
                onChange={(e) =>
                  setLoadParams({
                    ...loadParams,
                    gamemode: Number(e.target.value),
                  })
                }
                style={{
                  width: 70,
                  background: COLORS.panel,
                  border: `1px solid ${COLORS.line}`,
                  borderRadius: 6,
                  padding: "7px 10px",
                  color: COLORS.ink,
                  fontSize: 12.5,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                <option value="">Any</option>
                <option value="1">Duel</option>
                <option value="2">Small Team</option>
                <option value="3">Large Team</option>
                <option value="4">FFA</option>
                <option value="5">Team FFA</option>
              </select>
            </label>
            <label>
              Duration (minutes):
              <input
                type="number"
                min={5}
                value={loadParams.minDurationMinutes}
                onChange={(e) =>
                  setLoadParams({
                    ...loadParams,
                    minDurationMinutes: Number(e.target.value),
                  })
                }
                style={{
                  width: 70,
                  background: COLORS.panel,
                  border: `1px solid ${COLORS.line}`,
                  borderRadius: 6,
                  padding: "7px 10px",
                  color: COLORS.ink,
                  fontSize: 12.5,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              />
            </label>
            <label>
              Min-avg OS:
              <input
                type="number"
                value={loadParams.minimumAverageOS ?? ""}
                onChange={(e) =>
                  setLoadParams({
                    ...loadParams,
                    minimumAverageOS: Number(e.target.value),
                  })
                }
                style={{
                  width: 70,
                  background: COLORS.panel,
                  border: `1px solid ${COLORS.line}`,
                  borderRadius: 6,
                  padding: "7px 10px",
                  color: COLORS.ink,
                  fontSize: 12.5,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              />
            </label>
            <label>
              Scan Limit:
              <input
                type="number"
                min={5}
                max={100}
                value={loadParams.limit}
                onChange={(e) =>
                  setLoadParams({
                    ...loadParams,
                    limit: Number(e.target.value),
                  })
                }
                style={{
                  width: 70,
                  background: COLORS.panel,
                  border: `1px solid ${COLORS.line}`,
                  borderRadius: 6,
                  padding: "7px 10px",
                  color: COLORS.ink,
                  fontSize: 12.5,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              />
            </label>
            <button
              onClick={runLiveSearch}
              disabled={loading}
              style={{
                all: "unset",
                cursor: loading ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 7,
                background: COLORS.eco,
                color: COLORS.bg,
                padding: "8px 14px",
                borderRadius: 7,
                fontSize: 12.5,
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? (
                <Loader2
                  size={14}
                  className="spin"
                  style={{ animation: "spin 1s linear infinite" }}
                />
              ) : (
                <RefreshCw size={14} />
              )}
              {loading ? progress || "working…" : "Scan recent matches"}
            </button>
            <button
              onClick={handleSave}
              disabled={saved && matches.length === 0}
              style={{
                all: "unset",
                cursor: saved ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 7,
                background: COLORS.eco,
                color: COLORS.bg,
                padding: "8px 14px",
                borderRadius: 7,
                fontSize: 12.5,
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                opacity: saved ? 0.6 : 1,
              }}
            >
              {saved ? "Saved" : "Save this batch"}
            </button>
            <span style={{ fontSize: 11.5, color: COLORS.faint }}>
              results cache per match — re-scans skip what's already analyzed
            </span>
          </div>
        )}

        {error && (
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              background: `${COLORS.combat}12`,
              border: `1px solid ${COLORS.combat}44`,
              borderRadius: 9,
              padding: "12px 14px",
              marginBottom: 18,
              fontSize: 12.5,
              color: COLORS.ink,
              lineHeight: 1.5,
            }}
          >
            <AlertTriangle
              size={15}
              color={COLORS.combat}
              style={{ flexShrink: 0, marginTop: 1 }}
            />
            <span>{error}</span>
          </div>
        )}

        {/* filter bar */}
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          {MILESTONES.map((m) => {
            const active = activeFilters.has(m.key);
            const Icon = m.icon;
            return (
              <button
                key={m.key}
                onClick={() => toggleFilter(m.key)}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 11px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: "'Inter', sans-serif",
                  border: `1px solid ${active ? m.color : COLORS.line}`,
                  background: active ? `${m.color}20` : "transparent",
                  color: active ? m.color : COLORS.muted,
                }}
              >
                <Icon size={12.5} /> {m.label}
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              background: COLORS.panel,
              border: `1px solid ${COLORS.line}`,
              color: COLORS.ink,
              borderRadius: 7,
              padding: "6px 10px",
              fontSize: 12,
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            <option value="score">sort: spectate score</option>
            <option value="recent">sort: most recent</option>
            <option value="duration">sort: longest</option>
          </select>
        </div>

        {/* results */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.length === 0 && !loading && (
            <div
              style={{
                textAlign: "center",
                padding: "40px 0",
                color: COLORS.faint,
                fontSize: 13,
              }}
            >
              nothing matches these filters — loosen a milestone toggle or lower
              the score floor
            </div>
          )}
          {filtered.map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              analysis={analyses[m.id]}
              expanded={expandedId === m.id}
              onToggle={() => setExpandedId(expandedId === m.id ? null : m.id)}
            />
          ))}
        </div>

        <div
          style={{
            marginTop: "auto",
            fontSize: 11,
            color: COLORS.faint,
            lineHeight: 1.6,
          }}
        >
          scoring: comeback = winner was ever &gt;13pts behind in eco share ·
          photo finish = final eco share within 6pts on a 12m+ game · big battle
          = a damage spike &gt;2.6x the game's average burst · upset = 5+
          skill-gap team lost. weights are tunable in
        </div>
      </div>
    </div>
  );
}
