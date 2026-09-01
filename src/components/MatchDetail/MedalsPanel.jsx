import { frameToTime, formatUnitName } from "../../utils/medals.js";
import { getUnitImageUrl } from "../../utils/mapImages.js";
import "./MedalsPanel.css";

// Config-driven sections. Each section renders its top-3 entries on a podium
// (1st centered + tallest, like the Olympics) with a row of stat chips below.
// A `flair` field is reserved for a future "as much health as a bull"-style
// comparison line — reference table not wired up yet.
const SECTIONS = [
  {
    key: "veteranUnits",
    label: "Veteran Units",
    stats: [
      { key: "kills", label: "Kills", format: (v) => `${v}` },
      { key: "damageDealt", label: "Damage", format: (v) => v.toLocaleString() },
      { key: "buildFrame", label: "Built", format: (v) => frameToTime(v) },
      { key: "destroyedFrame", label: "Died", format: (v) => frameToTime(v), fallback: "Survived" },
    ],
  },
  {
    key: "killEfficiency",
    label: "Kill Efficiency",
    stats: [
      { key: "kills", label: "Kills", format: (v) => `${v}` },
      { key: "metalCost", label: "Cost", format: (v) => `${v.toLocaleString()} metal` },
      { key: "damageDealt", label: "Damage", format: (v) => v.toLocaleString() },
      { key: "buildFrame", label: "Built", format: (v) => frameToTime(v) },
      { key: "destroyedFrame", label: "Died", format: (v) => frameToTime(v), fallback: "Survived" },
    ],
  },
  {
    key: "damageTaken",
    label: "Damage Taken",
    stats: [
      { key: "totalDamageTaken", label: "Taken", format: (v) => `${v.toLocaleString()} dmg` },
      { key: "damageDealt", label: "Dealt", format: (v) => v.toLocaleString() },
      { key: "buildFrame", label: "Built", format: (v) => frameToTime(v) },
      { key: "destroyedFrame", label: "Died", format: (v) => frameToTime(v), fallback: "Survived" },
    ],
  },
];

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
  const [first, second, third] = entries;
  // Classic podium order: 2nd left, 1st center, 3rd right — but only when all
  // three exist. With 1-2 entries keep simple rank order.
  const ordered =
    entries.length === 3
      ? [second, first, third]
      : [first, second, third].filter(Boolean);

  return (
    <div className="medal-section">
      <h5 className="medal-section-title">{section.label}</h5>
      <div className="medal-podium">
        {ordered.map((entry) => {
          const rank = entry === first ? 1 : entry === second ? 2 : 3;
          return <PodiumSlot key={entry.unitID} entry={entry} rank={rank} />;
        })}
      </div>
      <div className="medal-stats-grid">
        {ordered.map((entry) => {
          const rank = entry === first ? 1 : entry === second ? 2 : 3;
          return (
            <div key={entry.unitID} className="medal-stat-column">
              <div className="medal-stat-column-head">
                <span className="medal-stat-rank">#{rank}</span>
                <span className="medal-stat-player">{entry.playerName}</span>
              </div>
              <div className="medal-stat-chips">
                {section.stats.map((stat) => {
                  const raw = entry[stat.key];
                  const value =
                    raw == null
                      ? (stat.fallback ?? "—")
                      : stat.format(raw);
                  return (
                    <div key={stat.key} className="medal-stat-chip">
                      <span className="medal-stat-label">{stat.label}</span>
                      <span className="medal-stat-value">{value}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PodiumSlot({ entry, rank }) {
  const destroyed = entry.destroyedFrame != null;
  return (
    <div className={`podium-slot rank-${rank}`}>
      <span className="podium-rank">{rank}</span>
      <div className="medal-unit-icon">
        <img
          src={getUnitImageUrl(entry.definitionName)}
          alt={entry.definitionName}
          className="medal-unit-image"
          loading="lazy"
        />
      </div>
      <span className="podium-unit-name">{formatUnitName(entry.definitionName)}</span>
      <span className="podium-player">{entry.playerName}</span>
      <span className={`podium-status ${destroyed ? "dead" : "alive"}`}>
        {destroyed ? "Destroyed" : "Alive"}
      </span>
    </div>
  );
}