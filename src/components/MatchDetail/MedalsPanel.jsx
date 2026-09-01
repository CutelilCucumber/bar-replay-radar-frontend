import { frameToTime, formatUnitName } from "../../utils/medals.js";
import { COLORS } from "../../utils/globalVars.js";
import { getUnitImageUrl } from "../../utils/mapImages.js";
import "./MedalsPanel.css";

const SECTIONS = [
  { key: "veteranUnits", label: "Veteran Units", metric: "rank" },
  { key: "killEfficiency", label: "Kill Efficiency", metric: "kills" },
  { key: "damageTaken", label: "Damage Taken", metric: "damageTaken" },
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

        return (
          <div key={section.key} className="medal-section">
            <h5 className="medal-section-title">{section.label}</h5>
            <div className="medal-list">
              {entries.map((entry, i) => (
                <MedalEntryRow
                  key={`${section.key}-${i}`}
                  entry={entry}
                  metric={section.metric}
                  rank={i + 1}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MedalEntryRow({ entry, metric, rank }) {
  const destroyed = entry.destroyedFrame != null;
  const unitImageUrl = getUnitImageUrl(entry.definitionName);

  return (
    <div className="medal-entry">
      <span className="medal-rank">#{rank}</span>
      <div className="medal-unit-icon">
        <img
          src={unitImageUrl}
          alt={entry.definitionName}
          className="medal-unit-image"
          loading="lazy"
        />
      </div>
      <div className="medal-info">
        <span className="medal-unit-name">{formatUnitName(entry.definitionName)}</span>
        <span className="medal-player">{entry.playerName}</span>
      </div>
      <div className="medal-stats">
        {metric === "rank" && (
          <>
            <span className="medal-stat-value">Rank {entry.rank}</span>
            <span className="medal-stat-detail">
              {entry.kills} kill{entry.kills !== 1 ? "s" : ""}
              {destroyed
                ? ` · Destroyed at ${frameToTime(entry.destroyedFrame)}`
                : " · Survived"}
            </span>
          </>
        )}
        {metric === "kills" && (
          <>
            <span className="medal-stat-value">{entry.kills} kills</span>
            <span className="medal-stat-detail">
              Rank {entry.rank}
              {entry.highestValueKill
                ? ` · Best: ${entry.highestValueKill.definitionName}`
                : ""}
            </span>
          </>
        )}
        {metric === "damageTaken" && (
          <>
            <span className="medal-stat-value">
              {(entry.totalDamageTaken ?? 0).toLocaleString()} dmg taken
            </span>
            <span className="medal-stat-detail">
              {entry.kills} kill{entry.kills !== 1 ? "s" : ""}
              {destroyed
                ? ` · Destroyed at ${frameToTime(entry.destroyedFrame)}`
                : " · Survived"}
            </span>
          </>
        )}
      </div>
      <span
        className="medal-status"
        style={{ color: destroyed ? COLORS.combat : COLORS.eco }}
      >
        {destroyed ? "Destroyed" : "Alive"}
      </span>
    </div>
  );
}
