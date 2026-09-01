import { useState } from "react";
import { COLORS } from "../../utils/globalVars.js";
import { getMapImageUrl } from "../../utils/mapImages.js";
import "./PositionsPanel.css";

export function PositionsPanel({ match }) {
  const [imgError, setImgError] = useState(false);

  const positionsA = (match.teamA?.facts?.startPositions ?? []).map((p) => ({
    ...p,
    team: "A",
  }));
  const positionsB = (match.teamB?.facts?.startPositions ?? []).map((p) => ({
    ...p,
    team: "B",
  }));
  const allPositions = [...positionsA, ...positionsB];

  if (allPositions.length === 0) {
    return <div className="panel-empty">No start position data available for this match.</div>;
  }

  const xs = allPositions.map((p) => p.x);
  const zs = allPositions.map((p) => p.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const rangeX = maxX - minX || 1;
  const rangeZ = maxZ - minZ || 1;
  // Pad so the outermost dot + its label stay inside the clipped container.
  const PAD = 8;

  const mapImageUrl = getMapImageUrl(match.mapName, match.map);

  return (
    <div className="positions-panel">
      <div className="positions-map-container">
        {!imgError ? (
          <img
            src={mapImageUrl}
            alt={`${match.map} minimap`}
            className="positions-map-bg"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="positions-map-placeholder">
            <span>{match.map}</span>
          </div>
        )}
        {allPositions.map((p, i) => {
          const left = PAD + ((p.x - minX) / rangeX) * (100 - 2 * PAD);
          const top = PAD + ((p.z - minZ) / rangeZ) * (100 - 2 * PAD);
          const teamColor = p.team === "A" ? COLORS.close : COLORS.combat;
          const color = p.color ?? teamColor;

          return (
            <div
              key={`${p.playerName}-${i}`}
              className="position-dot"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                borderColor: color,
                background: color,
              }}
              title={`${p.playerName} (Team ${p.team})`}
            >
              <span className="position-label" style={{ color }}>
                {p.playerName}
              </span>
            </div>
          );
        })}
      </div>
      <div className="positions-legend">
        <span className="legend-item">
          <span className="legend-dot" style={{ background: COLORS.close }} />
          Team A
        </span>
        <span className="legend-item">
          <span className="legend-dot" style={{ background: COLORS.combat }} />
          Team B
        </span>
      </div>
    </div>
  );
}
