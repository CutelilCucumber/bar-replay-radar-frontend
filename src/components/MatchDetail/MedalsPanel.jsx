import { COLORS } from "../../utils/globalVars.js";
import { frameToTime, formatUnitName } from "../../utils/medals.js";
import { getUnitImageUrl } from "../../utils/mapImages.js";
import "./MedalsPanel.css";

// Damage values are rounded to the nearest integer so the page never shows
// fractional dmg from the source event data.
const roundDamage = (v) => Math.round(v).toLocaleString();

// Config-driven sections. Each section has ONE primary metric that drives the
// center mini-bar column (dmg/cost, dmg, dmg taken, dmg), plus the stats that
// fill the right-hand table. Units live in the column labels, not the cell
// values, so the table stays narrow enough to fit without horizontal scroll.
const SECTIONS = [
  {
    key: "damageEfficiency",
    label: "Damage Efficiency",
    primary: {
      label: "Damage / Cost",
      value: (e) => {
        const cost = Number(e.metalCost ?? 0);
        const dmg = Number(e.damageDealt ?? 0);
        return cost > 0 ? dmg / cost : dmg;
      },
      format: (v) => `${v.toFixed(1)} dmg/c`,
    },
    stats: [
      { key: "kills", label: "Kills", format: (v) => `${v}` },
      { key: "metalCost", label: "Cost (m)", format: (v) => v.toLocaleString() },
      { key: "damageDealt", label: "Damage", format: (v) => roundDamage(v) },
      { key: "buildFrame", label: "Built", format: (v) => frameToTime(v) },
      { key: "destroyedFrame", label: "Died", format: (v) => frameToTime(v), fallback: "--:--" },
    ],
  },
  {
    key: "damageDealt",
    label: "Damage Dealt",
    primary: {
      label: "Damage",
      value: (e) => Number(e.damageDealt ?? 0),
      format: (v) => `${roundDamage(v)} dmg`,
    },
    stats: [
      { key: "kills", label: "Kills", format: (v) => `${v}` },
      { key: "metalCost", label: "Cost (m)", format: (v) => v.toLocaleString() },
      { key: "buildFrame", label: "Built", format: (v) => frameToTime(v) },
      { key: "destroyedFrame", label: "Died", format: (v) => frameToTime(v), fallback: "--:--" },
    ],
  },
  {
    key: "damageTaken",
    label: "Damage Taken",
    primary: {
      label: "Damage Taken",
      value: (e) => Number(e.totalDamageTaken ?? 0),
      format: (v) => roundDamage(v),
    },
    stats: [
      { key: "totalDamageTaken", label: "Taken (dmg)", format: (v) => roundDamage(v) },
      { key: "damageDealt", label: "Dealt (dmg)", format: (v) => roundDamage(v) },
      { key: "buildFrame", label: "Built", format: (v) => frameToTime(v) },
      { key: "destroyedFrame", label: "Died", format: (v) => frameToTime(v), fallback: "--:--" },
    ],
  },
  {
    key: "veteranUnits",
    label: "Veteran Units",
    primary: {
      label: "Damage",
      value: (e) => Number(e.damageDealt ?? 0),
      format: (v) => `${roundDamage(v)} dmg`,
    },
    stats: [
      { key: "kills", label: "Kills", format: (v) => `${v}` },
      { key: "damageDealt", label: "Damage", format: (v) => roundDamage(v) },
      { key: "buildFrame", label: "Built", format: (v) => frameToTime(v) },
      { key: "destroyedFrame", label: "Died", format: (v) => frameToTime(v), fallback: "--:--" },
    ],
  },
];

// Rank color, not opacity: #1 gold, #2 silver, #3 bronze.
const RANK_META = {
  1: { color: "#f2c94c" },
  2: { color: "#c9d4e0" },
  3: { color: "#d18a54" },
};

const DEFAULT_UNIT_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect fill='%23333' width='64' height='64'/%3E%3Ctext x='32' y='38' font-size='10' fill='%23666' text-anchor='middle' font-family='monospace'%3E?%3C/text%3E%3C/svg%3E";

// Prefer the baked-in player color; fall back to the team's flat color so
// records without color data still render (mirrors AwardsPanel).
function displayColor(entry) {
  if (entry?.color) return entry.color;
  return entry?.allyTeam === "A" ? COLORS.close : COLORS.combat;
}

function formatStatValue(stat, raw) {
  if (raw == null) return stat.fallback ?? "—";
  return stat.format(raw);
}

export function MedalsPanel({ medals }) {
  if (!medals) {
    return <div className="panel-empty">No medal data available for this match.</div>;
  }

  return (
    <div className="medals-panel">
      {SECTIONS.map((section) => {
        const entries = medals[section.key];
        if (!entries || entries.length === 0) return null;
        return <MedalSection key={section.key} section={section} entries={entries} />;
      })}
    </div>
  );
}

function MedalSection({ section, entries }) {
  const { primary } = section;
  const barMax = Math.max(1, ...entries.map((e) => primary.value(e)));
  const tableColumns = `minmax(48px, 1.1fr) repeat(${section.stats.length}, minmax(50px, 1fr))`;

  return (
    <section className="medal-section">
      <h5 className="medal-section-title">{section.label}</h5>
      {/*
        Each row is one grid item spanning all three columns, using `subgrid`
        to share the parent's column tracks. Image, mini bar, and stat cells
        therefore stay pixel-aligned across every row, and hovering a row
        highlights all three cells together.
      */}
      <div className="medal-section-body" style={{ "--table-cols": tableColumns }}>
        <div className="medal-row medal-head-row">
          <div className="medal-col-head medal-col-head-empty" />
          <div className="medal-col-head medal-chart-head">{primary.label}</div>
          <div className="medal-col-head">
            <div className="medal-table-row medal-table-head">
              <span className="medal-table-player">Player</span>
              {section.stats.map((s) => (
                <span key={s.key} className="medal-table-stat">
                  {s.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {entries.map((entry, i) => {
          const raw = primary.value(entry);
          const pct = Math.max(1.5, (raw / barMax) * 100);
          return (
            <div className="medal-row" key={entry.unitID}>
              <div className="medal-media">
                <EntryMedia entry={entry} rank={i + 1} />
              </div>
              <div className="medal-bar-cell">
                <div className="medal-bar-track">
                  <div
                    className="medal-bar-fill"
                    style={{ width: `${pct}%`, background: displayColor(entry) }}
                  />
                </div>
                <span className="medal-bar-value">{primary.format(raw)}</span>
              </div>
              <div className="medal-table-row">
                <span
                  className="medal-table-player"
                  style={{ color: displayColor(entry) }}
                >
                  {entry.playerName}
                </span>
                {section.stats.map((s) => (
                  <span key={s.key} className="medal-table-stat">
                    {formatStatValue(s, entry[s.key])}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function EntryMedia({ entry, rank }) {
  const color = displayColor(entry);
  const destroyed = entry.destroyedFrame != null;
  const rankColor = RANK_META[rank]?.color ?? COLORS.muted;

  return (
    <div className="medal-card-media">
      <img
        src={getUnitImageUrl(entry.definitionName)}
        alt={entry.definitionName}
        className="medal-card-image"
        loading="lazy"
        onError={(e) => {
          if (e.currentTarget.dataset.fallback === "1") return;
          e.currentTarget.dataset.fallback = "1";
          e.currentTarget.src = DEFAULT_UNIT_IMAGE;
        }}
      />
      <span className="medal-card-rank" style={{ color: rankColor }}>
        #{rank}
      </span>
      <div className="medal-card-identity">
        <span className="medal-card-unit-name" style={{ color }}>
          {formatUnitName(entry.definitionName)}
        </span>
        <span className={`medal-card-status ${destroyed ? "dead" : "alive"}`}>
          {destroyed ? "Destroyed" : "Survived"}
        </span>
      </div>
    </div>
  );
}