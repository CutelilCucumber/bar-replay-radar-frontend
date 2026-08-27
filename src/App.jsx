import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { MatchCard } from "./components/MatchCard/MatchCard.jsx";
import { MatchLoad } from "./components/ui/MatchLoad.jsx";
import {
  MatchFilterSidebar,
  DEFAULT_FILTERS,
} from "./components/Filter/Filter.jsx";
import { listMatches, lookupMatch } from "./utils/api.js";
import { COLORS } from "./utils/globalVars.js";
import "./App.css";
import {
  deleteSavedMatch,
  getSavedMatches,
  isMatchSaved,
  saveMatch,
} from "./utils/storage.js";

export default function App() {
  const [mode, setMode] = useState("scan"); // "saved" | "scan" | "find"
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [matches, setMatches] = useState([]);
  const [fetchedMatches, setFetchedMatches] = useState([]);
  const [resultTotal, setResultTotal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [spoiled, setSpoiled] = useState(false);
  const [loadCount, setLoadCount] = useState(0);

  // --- single match lookup by ID ("find" mode) ---
  const [lookupId, setLookupId] = useState("");
  const [lookupResult, setLookupResult] = useState(null); // { status, match? | message? | error? }
  const [lookupLoading, setLookupLoading] = useState(false);

  useEffect(() => {
    if (mode === "saved") {
      setMatches(getSavedMatches());
    } else if (mode === "find") {
      setMatches(lookupResult?.status === "ready" ? [lookupResult.match] : []);
    } else {
      setMatches(fetchedMatches);
    }
    setLoading(false);
  }, [mode, fetchedMatches, loadCount, lookupResult]);

  useEffect(() => {
    runLiveSearch();
  }, []);

  const filtered = useMemo(() => {
    let list = matches.filter((m) => {
      if (filters.scoreMin != null && m.score < filters.scoreMin) return false;
      if (filters.scoreMax != null && m.score > filters.scoreMax) return false;

      // Milestone requirements only need re-checking locally in "saved" mode.
      // In "scan" mode, fetchedMatches already came back pre-filtered by the
      // backend query, so re-applying the same filter here would be redundant.
      if (mode === "saved") {
        for (const [key, required] of Object.entries(filters.milestones ?? {})) {
          if (Boolean(m[key]) !== required) return false;
        }
      }
      return true;
    });

    list = list.slice().sort((a, b) => {
      const dir = filters.sortDir === "asc" ? 1 : -1;
      if (filters.sortBy === "score") return (a.score - b.score) * dir;
      if (filters.sortBy === "startTime") {
        return (new Date(a.startTime) - new Date(b.startTime)) * dir;
      }
      if (filters.sortBy === "duration") return (a.durationMin - b.durationMin) * dir;
      return 0;
    });

    return list;
  }, [matches, filters, mode]);

  const runLiveSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { matches: results, total } = await listMatches(filters);
      if (results.length === 0) {
        setError("Connected, but no matches were found with this criteria.");
      }
      setFetchedMatches(results);
      setResultTotal(total);
      setMode("scan"); // otherwise the "saved" mode effect immediately overwrites these results
    } catch (e) {
      setError(`${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  /**
   * forceRefresh is passed through on manual retry (the "processing" state's
   * retry button) — a plain re-run without it would just return the same
   * cached-or-not result from lookupMatch's internal cache check.
   */
  const runLookup = useCallback(
    async (forceRefresh = false) => {
      const id = lookupId.trim();
      if (!id) return;
      setLookupLoading(true);
      setError(null);
      try {
        const result = await lookupMatch(id, { forceRefresh });
        setLookupResult(result);
      } catch (e) {
        setLookupResult({ status: "error", error: e.message ?? String(e) });
      } finally {
        setLookupLoading(false);
      }
    },
    [lookupId],
  );

  const handleSave = (match) => {
    if (isMatchSaved(match.id)) {
      setError("Match: " + match.id + " is already saved");
      return;
    }
    try {
      saveMatch(match);
      setLoadCount(loadCount + 1);
    } catch (e) {
      setError(e.message ?? String(e));
    }
  };

  const handleDelete = (matchID) => {
    if (!isMatchSaved(matchID)) {
      setError("Match: " + matchID + " has not been saved");
      return;
    }
    try {
      deleteSavedMatch(matchID);
      setLoadCount(loadCount + 1);
    } catch (e) {
      setError(e.message ?? String(e));
    }
  };

  const getTitle = (by, dir) => {
  switch (by) {
    case "score":
      return dir === "desc" ? "Highest Scored Games" : "Lowest Scored Games";
    case "startTime":
      return dir === "desc" ? "Recent Games" : "Oldest Games";
    case "duration":
      return dir === "desc" ? "Longest Games" : "Shortest Games";
    default:
      return "Unknown Sorting";
  }
}

  return (
    <div className="page-container">
      <main className="page">
        {/* header */}
        <header className="header-container">
          <img src="/radarIcon.png" alt="radar bot" style={{ height: 100 }} />
          <div>
            <div className="page-title-container">
              <h1>Replay Radar</h1>
            </div>
            <p className="sub-header">
              Scores Beyond All Reason replays based on how good they are to
              watch · built on <a href="https://gex.honu.pw/">gex</a>
            </p>
          </div>
        </header>

        <aside>
          <MatchFilterSidebar
            filters={filters}
            onFiltersChange={setFilters}
            onSearch={runLiveSearch}
            loading={loading}
            resultTotal={resultTotal}
            spoiled={spoiled}
            onSpoiledChange={setSpoiled}
          />
        </aside>

        <div className="mode-switch">
          {["saved", "scan", "find"].map((m) => (
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

        {mode === "find" && (
          <div className="option-container">
            <input
              type="text"
              placeholder="Match ID"
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runLookup()}
              className="field-filter"
              style={{ width: 280 }}
            />
            <button
              onClick={() => runLookup()}
              disabled={lookupLoading || !lookupId.trim()}
              className="scan-button"
            >
              {lookupLoading ? (
                <Loader2 size={14} className="spin" style={{ animation: "spin 1s linear infinite" }} />
              ) : (
                <Search size={14} />
              )}
              {lookupLoading ? "looking up…" : "Look up"}
            </button>
          </div>
        )}

        {/* sort title */}
        
        {/* results */}
        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {error && <div className="no-matches">{error}</div>}

          {matches.length > 0 &&mode !== "find" && (
          <h2>{getTitle(filters.sortBy, filters.sortDir)}</h2>
        )}

          {mode === "find" ? (
            <>
              {lookupResult?.status === "processing" && (
                <div className="no-matches">
                  {lookupResult.message}
                  <button
                    onClick={() => runLookup(true)}
                    className="scan-button"
                    style={{ marginLeft: 10 }}
                  >
                    <RefreshCw size={14} /> Retry
                  </button>
                </div>
              )}
              {lookupResult?.status === "notFound" && (
                <div className="no-matches">No match found with id "{lookupId}".</div>
              )}
              {(lookupResult?.status === "insufficientData" || lookupResult?.status === "error") && (
                <div className="no-matches">
                <a href={`https://gex.honu.pw/match/${lookupId}`} target="_blank">
                  {lookupResult.error}. prioritize gex processing here
                </a>
                </div>
              )}
              {!lookupResult && !lookupLoading && (
                <div className="no-matches">Enter a match ID above and click Look up.</div>
              )}
            </>
          ) : (
            filtered.length === 0 &&
            !loading &&
            !error && (
              <div className="no-matches">
                No matches to display — scan for matches or loosen filter settings
              </div>
            )
          )}

          {loading ? (
            <MatchLoad />
        ) : (
          
          (mode === "find" ? matches : filtered).map((m) => (
            
            <MatchCard
              key={m.id}
              match={m}
              analysis={m.analysis}
              expanded={expandedId === m.id}
              onToggle={() => setExpandedId(expandedId === m.id ? null : m.id)}
              isSaved={isMatchSaved(m.id)}
              onSave={() => handleSave(m)}
              onDelete={() => handleDelete(m.id)}
              spoiled={spoiled}
            />
          ))
        )}
        </section>

        <footer className="scoring-tooltip">
          a tool by{" "}
          <a href="https://github.com/CutelilCucumber">Gldneye</a>
        </footer>
      </main>
    </div>
  );
}
