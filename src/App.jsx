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
import { MatchCard } from "./components/MatchCard/MatchCard.jsx";
import { analyzeMatch } from "./utils/analyzeMatch.js";
import { fetchLiveMatches } from "./utils/matchData.js";
import {
  GEX_API_BASE,
  COLORS,
  FONT_IMPORT,
  FRAMES_PER_SECOND,
} from "./utils/globalVars.js";
import { MILESTONES } from "./utils/awards.js";
import "./App.css";

export default function App() {
  const [mode, setMode] = useState("saved"); // "saved" | "scan" | find
  const [loadParams, setLoadParams] = useState({
    limit: 20,
    gamemode: null,
    minDurationMinutes: 5,
    minPlayers: null,
    minimumAverageOS: null,
  });
  const [activeFilters, setActiveFilters] = useState({});
  const [expandBadges, setExpandBadges] = useState(false);
  const [saved, setSaved] = useState(true);
  const [matches, setMatches] = useState([]);
  const [newMatches, setNewMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [minScore, setMinScore] = useState(0);
  const [sortBy, setSortBy] = useState("score");
  const [loadCount, setLoadCount] = useState(0);

  useEffect(() => {
    if (mode === "saved") {
      const cachedMatches = localStorage.getItem("saved-matches");
      setMatches(cachedMatches ? JSON.parse(cachedMatches) : []);
    } else {
      setMatches(newMatches);
    }
    setLoading(false);
  }, [mode, newMatches, loadCount]);

  const analyses = useMemo(() => {
    const map = {};
    for (const m of matches) map[m.id] = analyzeMatch(m);
    return map;
  }, [matches]);

  const filtered = useMemo(() => {
    let list = matches.filter((m) => {
      const a = analyses[m.id];
      if (a.score < minScore) return false;

      // Check if activeFilters is non-empty
      const hasActiveFilters = Object.keys(activeFilters).length > 0;
      if (
        hasActiveFilters &&
        !Object.keys(activeFilters).every((f) => a.flags[f])
      ) {
        return false;
      }
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
      setSaved(false);
      setNewMatches(results);
    } catch (e) {
      setError(`${e.message}`);
    } finally {
      setLoading(false);
      setProgress("");
    }
  }, [GEX_API_BASE, loadParams]);

  const toggleFilter = (key) => {
    setActiveFilters((prev) => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = true;
      }
      return next;
    });
  };
  const toggleBadgeBox = () => {
    setExpandBadges(!expandBadges);
  };

  const handleSaveAll = () => {
    matches.forEach((matchId) => {
      handleSave(matchId);
    });
    setSaved(true);
  };

  const handleSave = (match) => {
    if (inCache(match.id)) {
      setError("Match: " + match.id + " is already saved");
      return;
    }
    const cache = localStorage.getItem("saved-matches");
    const cachedMatches = cache ? JSON.parse(cache) : [];

    const updatedMatches = [...cachedMatches, match];
    try {
      localStorage.setItem("saved-matches", JSON.stringify(updatedMatches));
      setLoadCount(loadCount + 1);
    } catch (e) {
      setError(e);
    }
  };

  const handleDelete = (matchID) => {
    if (!inCache(matchID)) {
      setError("Match: " + match.id + " has not been saved");
      return;
    }

    const cache = localStorage.getItem("saved-matches");
    const cachedMatches = cache ? JSON.parse(cache) : [];

    const updatedMatches = cachedMatches.filter((m) => m.id !== matchID);

    try {
      localStorage.setItem("saved-matches", JSON.stringify(updatedMatches));
      setLoadCount(loadCount + 1);
    } catch (e) {
      setError(e);
    }
  };

  function inCache(matchID) {
    const cache = localStorage.getItem("saved-matches");
    const cachedMatches = cache ? JSON.parse(cache) : [];
    return cachedMatches.some((m) => m.id === matchID);
  }

  return (
    <div className="page-container">
      <main className="page">
        {/* header */}
        <header className="header-container">
          <img src="../public/radarIcon.png" alt="radar bot" style={{height: 100}}/>
          <div>
            <div className="page-title-container">
              <h1>Replay Radar</h1>
            </div>
            <p className="sub-header">
              Scores Beyond All Reason replays based on how good they are to watch · built on{" "}
              <a href="https://gex.honu.pw/">gex</a>
            </p>
          </div>
        </header>

        <div className="mode-switch">
            {["saved", "scan"].map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="mode-switch-button"
                style={{
                  background: mode === m ? COLORS.eco : "transparent",
                  color: mode === m ? COLORS.bg : COLORS.ink,
                }}
              >
                {m.toUpperCase()}
              </button>
            ))}
          </div>

        {/* live controls */}
        {mode === "scan" && (
          <fieldset className="option-container">
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

                className="field-filter"
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
                className="field-filter"
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
                className="field-filter"
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
                className="field-filter"
              />
            </label>
            <button
              onClick={runLiveSearch}
              disabled={loading}
              className="scan-button"
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
              onClick={handleSaveAll}
              disabled={saved && matches.length === 0}
              className="scan-button"
            >
              {saved ? "Saved" : "Save batch"}
            </button>
          </fieldset>
        )}

        {error && (
          <output className="error">
            <AlertTriangle
              size={15}
              color={COLORS.combat}
              style={{ flexShrink: 0, marginTop: 1 }}
            />
            <span>{error}</span>
          </output>
        )}

        {/* milestone bar */}

        <nav className={`filter-container ${expandBadges ? "expanded" : ""}`}>
          <div className="option-badge" >
            <span className="badge-show"
              onClick={toggleBadgeBox}>
              {expandBadges ? "Hide Award Filters ⌄" : "Show Award Filters >"}
            </span>

            {expandBadges && (
              <fieldset className="badge-container">
                {MILESTONES.map((m) => {
                  const isSelected = activeFilters[m.key];
                  const Icon = m.icon;

                  return (
                    <button
                      key={m.key}
                      onClick={() => toggleFilter(m.key)}
                      className="milestone-button"
                      title={m.description}
                      style={{
                        border: isSelected
                          ? `1px solid var(${m.color})`
                          : "1px solid var(--color-line)",
                        color: isSelected
                          ? `var(${m.color})`
                          : "var(--color-faint)",
                        transform: isSelected
                          ? "translateY(-2px)"
                          : "translateY(0)",
                        transition: "transform 0.2s ease",
                      }}
                    >
                      <Icon size={12.5} /> {m.label}
                    </button>
                  );
                })}
              </fieldset>
            )}
          </div>

          <select className="option-container" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="score">Sort by: spectate score</option>
            <option value="recent">Sort by: most recent</option>
            <option value="duration">Sort by: longest game</option>
          </select>
        </nav>

        {/* results */}
        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.length === 0 && !loading && (
            <div className="no-matches">
              No matches to display — scan for matches or loosen filter settings
            </div>
          )}
          {filtered.map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              analysis={analyses[m.id]}
              expanded={expandedId === m.id}
              onToggle={() => setExpandedId(expandedId === m.id ? null : m.id)}
              isSaved={inCache(m.id)}
              onSave={() => handleSave(m)}
              onDelete={() => handleDelete(m.id)}
            />
          ))}
        </section>

        <footer className="scoring-tooltip">
          a tool by{" "}
          <a href="https://github.com/CutelilCucumber">cutelilcucumber</a>
        </footer>
      </main>
    </div>
  );
}
