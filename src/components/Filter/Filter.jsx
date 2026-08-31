import { useState } from "react";
import { COLORS } from "../../utils/globalVars.js";
import { MILESTONES, MILESTONE_CATEGORIES } from "../../utils/milestones.js";
import { MAPLIST } from "../../utils/matchList.js";
import {
  SlidersHorizontal,
  X,
  RefreshCw,
  Loader2,
  RotateCcw,
} from "lucide-react";
import "./Filter.css";

export const DEFAULT_FILTERS = {
  limit: 20,
  offset: 0,
  sortBy: "startTime",
  sortDir: "desc",
  gamemode: undefined,
  map: undefined,
  playerCountMin: undefined,
  playerCountMax: undefined,
  averageOSMin: undefined,
  averageOSMax: undefined,
  scoreMin: undefined,
  scoreMax: undefined,
  durationMin: undefined,
  durationMax: undefined,
  startTimeAfter: undefined,
  startTimeBefore: undefined,
  milestones: {}, // { [milestoneKey]: true | false }, absent = don't filter
};

/** Converts an input's raw string value into a filter value: "" clears the filter (undefined), not 0/NaN. */
function parseOptionalNumber(raw) {
  return raw === "" ? undefined : Number(raw);
}

/**
 * Filter sidebar covering every GET /matches search param: gamemode, player
 * count / average OS / score / duration ranges, start time range, sort,
 * limit, and per-milestone include/exclude. "Spoil" is intentionally kept
 * separate — it's a display preference, not a search param, so it's never
 * sent to the backend.
 */
export function MatchFilterSidebar({
  filters,
  onFiltersChange,
  onSearch,
  loading = false,
  resultTotal = null,
  spoiled,
  onSpoiledChange,
}) {
  const [open, setOpen] = useState(false);

  const activeFilterCount = countActiveFilters(filters);

  function updateFilter(key, value) {
    onFiltersChange({ ...filters, [key]: value });
  }

  function cycleMilestone(key) {
    const current = filters.milestones?.[key];
    // unset -> require (true) -> exclude (false) -> unset
    const next = current === undefined ? true : current === true ? false : undefined;
    const milestones = { ...filters.milestones };
    if (next === undefined) delete milestones[key];
    else milestones[key] = next;
    onFiltersChange({ ...filters, milestones });
  }

  function handleReset() {
    onFiltersChange(DEFAULT_FILTERS);
  }

  function handleSearch() {
    onSearch();
    setOpen(false);
  }

  return (
    <>
      <button
        className="filter-sidebar-toggle"
        onClick={() => setOpen(true)}
        aria-expanded={open}
      >
        <SlidersHorizontal size={14} />
        Filters
        {activeFilterCount > 0 && <span className="filter-count-badge">{activeFilterCount}</span>}
      </button>

      {open && <div className="filter-sidebar-scrim" onClick={() => setOpen(false)} />}

      <aside className={`filter-sidebar ${open ? "open" : ""}`}>
        <div className="filter-sidebar-header">
          <span>Search Filters</span>
          <button className="filter-sidebar-close" onClick={() => setOpen(false)}>
            <X size={16} />
          </button>
        </div>

        <div className="filter-sidebar-body">
          <section className="filter-section">
            <h4 className="filter-section-title">Match criteria</h4>

            <label className="filter-field">
              Gamemode
              <select
                value={filters.gamemode ?? ""}
                onChange={(e) =>
                  updateFilter("gamemode", e.target.value === "" ? undefined : Number(e.target.value))
                }
                className="field-filter"
              >
                {GAMEMODES.map((g) => (
                  <option key={g.label} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="filter-field">
              Map
              <input
                list="map-list"
                placeholder="Any"
                type="text"
                value={filters.map ?? ""}
                onChange={(e) =>
                  updateFilter("map", e.target.value === "" ? undefined : e.target.value)
                }
                className="field-filter"
              />
                <datalist id="map-list">
                {MAPLIST.map((m) => (
                  <option key={m.label} value={m.label}>

                  </option>
                ))}
              </datalist>
            </label>

            <div className="filter-range-row">
              <label className="filter-field">
                Player count min
                <input
                  type="number"
                  min={1}
                  value={filters.playerCountMin ?? ""}
                  onChange={(e) => updateFilter("playerCountMin", parseOptionalNumber(e.target.value))}
                  className="field-filter"
                />
              </label>
              <label className="filter-field">
                Player count max
                <input
                  type="number"
                  min={1}
                  value={filters.playerCountMax ?? ""}
                  onChange={(e) => updateFilter("playerCountMax", parseOptionalNumber(e.target.value))}
                  className="field-filter"
                />
              </label>
            </div>

            <div className="filter-range-row">
              <label className="filter-field">
                Duration min (m)
                <input
                  type="number"
                  min={0}
                  value={filters.durationMin ?? ""}
                  onChange={(e) => updateFilter("durationMin", parseOptionalNumber(e.target.value))}
                  className="field-filter"
                />
              </label>
              <label className="filter-field">
                Duration max (m)
                <input
                  type="number"
                  min={0}
                  value={filters.durationMax ?? ""}
                  onChange={(e) => updateFilter("durationMax", parseOptionalNumber(e.target.value))}
                  className="field-filter"
                />
              </label>
            </div>

            <div className="filter-range-row">
              <label className="filter-field">
                Avg OS min
                <input
                  type="number"
                  value={filters.averageOSMin ?? ""}
                  onChange={(e) => updateFilter("averageOSMin", parseOptionalNumber(e.target.value))}
                  className="field-filter"
                />
              </label>
              <label className="filter-field">
                Avg OS max
                <input
                  type="number"
                  value={filters.averageOSMax ?? ""}
                  onChange={(e) => updateFilter("averageOSMax", parseOptionalNumber(e.target.value))}
                  className="field-filter"
                />
              </label>
            </div>

            <div className="filter-range-row">
              <label className="filter-field">
                Score min
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={filters.scoreMin ?? ""}
                  onChange={(e) => updateFilter("scoreMin", parseOptionalNumber(e.target.value))}
                  className="field-filter"
                />
              </label>
              <label className="filter-field">
                Score max
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={filters.scoreMax ?? ""}
                  onChange={(e) => updateFilter("scoreMax", parseOptionalNumber(e.target.value))}
                  className="field-filter"
                />
              </label>
            </div>

            <div className="filter-range-row">
              <label className="filter-field">
                Played after
                <input
                  type="datetime-local"
                  value={filters.startTimeAfter ? new Date(filters.startTimeAfter).toLocaleString('sv-SE').replace(' ', 'T') : ""}
                  onChange={(e) =>
                    updateFilter("startTimeAfter", e.target.value ? new Date(e.target.value).toISOString() : undefined)
                  }
                  className="field-filter"
                />
              </label>
              <label className="filter-field">
                Played before
                <input
                  type="datetime-local"
                  value={filters.startTimeBefore ? new Date(filters.startTimeBefore).toLocaleString('sv-SE').replace(' ', 'T') : ""}
                  onChange={(e) =>
                    updateFilter("startTimeBefore", e.target.value ? new Date(e.target.value).toISOString() : undefined)
                  }
                  className="field-filter"
                />
              </label>
            </div>
          </section>

          <section className="filter-section">
            <h4 className="filter-section-title">Sort &amp; limit</h4>
            <div className="filter-range-row">
              <label className="filter-field">
                Sort by
                <select
                  value={filters.sortBy}
                  onChange={(e) => updateFilter("sortBy", e.target.value)}
                  className="field-filter"
                >
                  <option value="score">Spectate score</option>
                  <option value="startTime">Most recent</option>
                  <option value="duration">Longest game</option>
                </select>
              </label>
              <label className="filter-field">
                Direction
                <select
                  value={filters.sortDir}
                  onChange={(e) => updateFilter("sortDir", e.target.value)}
                  className="field-filter"
                >
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </label>
            </div>
            <label className="filter-field">
              Result limit
              <span className="filter-section-hint">max 1000</span>
              <input
                type="number"
                min={0}
                max={1000}
                value={filters.limit}
                onChange={(e) => updateFilter("limit", e.target.value)}
                className="field-filter"
              />
            </label>
          </section>

          <section className="filter-section">
            <h4 className="filter-section-title">
              Milestones
            </h4>
            {MILESTONE_CATEGORIES.map((cat) => (
              <div key={cat.key} className="milestone-category">
                <h5 className="milestone-category-title">{cat.label}</h5>
                <div className="badge-container">
                  {MILESTONES.filter((m) => m.category === cat.key).map((m) => {
                    const state = filters.milestones?.[m.key];
                    const Icon = m.icon;
                    const style =
                      state === true
                        ? { border: `1px solid var(${m.color})`, color: `var(${m.color})` }
                        : state === false
                          ? { border: `1px solid var(--color-upset)`, color: `var(--color-upset)`, opacity: 0.7 }
                          : { border: "1px solid var(--color-line)", color: "var(--color-faint)" };

                    return (
                      <button
                        key={m.key}
                        onClick={() => cycleMilestone(m.key)}
                        className="milestone-button"
                        title={state === false ? `Exclude: ${m.description}` : m.description}
                        style={style}
                      >
                        <Icon size={12.5} />
                        {m.label}
                        {state === false && " (excluded)"}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>

          <section className="filter-section">
            <h4 className="filter-section-title">Display</h4>
            <label className="filter-field">
              Spoilers
              <select
                value={spoiled}
                onChange={(e) => onSpoiledChange(e.target.value)}
                className="field-filter"
              >
                <option value={false}>Spoil: none</option>
                <option value="milestone">Spoil: milestones</option>
                <option value="winner">Spoil: winner</option>
                <option value="both">Spoil: milestones and winner</option>
              </select>
            </label>
          </section>
        </div>

        <div className="filter-sidebar-footer">
          {resultTotal != null && (
            <span className="filter-result-count" style={{ color: COLORS.eco }}>
              {resultTotal} matches match this criteria
            </span>
          )}
          <div className="filter-sidebar-actions">
            <button onClick={handleReset} className="filter-reset-button" disabled={loading}>
              <RotateCcw size={13} />
              Reset
            </button>
            <button onClick={handleSearch} disabled={loading} className="scan-button">
              {loading ? (
                <Loader2 size={14} className="spin" style={{ animation: "spin 1s linear infinite" }} />
              ) : (
                <RefreshCw size={14} />
              )}
              {loading ? "working…" : "Search"}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function countActiveFilters(filters) {
  let count = 0;
  for (const key of Object.keys(DEFAULT_FILTERS)) {
    if (key === "milestones" || key === "sortBy" || key === "sortDir" || key === "limit" || key === "offset") continue;
    if (filters[key] !== undefined) count++;
  }
  count += Object.keys(filters.milestones ?? {}).length;
  return count;
}

const GAMEMODES = [
  { value: "", label: "Any" },
  { value: 1, label: "Duel" },
  { value: 2, label: "Small Team" },
  { value: 3, label: "Large Team" },
  { value: 4, label: "FFA" },
  { value: 5, label: "Team FFA" },
];