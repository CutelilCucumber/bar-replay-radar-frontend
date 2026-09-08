import { useState } from "react";
import { COLORS } from "../../utils/globalVars.js";
import { getMapImageUrl } from "../../utils/mapImages.js";
import "./PlayersPanel.css";

export function PlayersPanel({ match }) {
  const [imgError, setImgError] = useState(false);

  const teams = [
    {
      key: "A",
      label: "Team A",
      color: COLORS.close,
      positions: (match.teamA?.facts?.startPositions ?? []).map((p) => ({
        ...p,
        team: "A",
      })),
    },
    {
      key: "B",
      label: "Team B",
      color: COLORS.combat,
      positions: (match.teamB?.facts?.startPositions ?? []).map((p) => ({
        ...p,
        team: "B",
      })),
    },
  ];
  const allPositions = teams.flatMap((t) => t.positions);

  if (allPositions.length === 0) {
    return <div className="panel-empty">Roster data not available for this match.</div>;
  }

  // Use map dimensions for normalization if available (mapWidth/mapHeight in elmos).
  // This correctly positions commanders on the full map image.
  // Fallback: normalize to the actual commander position range (old behavior).
  const mapWidth = match.mapWidth;
  const mapHeight = match.mapHeight;
  const useMapDimensions = mapWidth && mapHeight && mapWidth > 0 && mapHeight > 0;

  let minX, maxX, minZ, maxZ, rangeX, rangeZ, PAD;

  if (useMapDimensions) {
    minX = 0;
    maxX = mapWidth;
    minZ = 0;
    maxZ = mapHeight;
    rangeX = mapWidth;
    rangeZ = mapHeight;
    PAD = 2; // Smaller pad since we're using full map bounds
  } else {
    const xs = allPositions.map((p) => p.x);
    const zs = allPositions.map((p) => p.z);
    minX = Math.min(...xs);
    maxX = Math.max(...xs);
    minZ = Math.min(...zs);
    maxZ = Math.max(...zs);
    rangeX = maxX - minX || 1;
    rangeZ = maxZ - minZ || 1;
    PAD = 8;
  }

  console.log("[PlayersPanel diagnostics]", {
    matchId: match.id,
    map: match.map,
    mapDataWidth: match.mapData?.width ?? "n/a",
    mapDataHeight: match.mapData?.height ?? "n/a",
    mapWidth,
    mapHeight,
    useMapDimensions,
    branch: useMapDimensions ? "map-dimensions" : "fallback",
    nPlayers: allPositions.length,
    posExtentX: useMapDimensions ? null : { minX, maxX },
    posExtentZ: useMapDimensions ? null : { minZ, maxZ },
    positions: allPositions.map((p) => ({ name: p.playerName, x: p.x, z: p.z })),
  });

  const mapImageUrl = getMapImageUrl(match.mapName, match.map);

  return (
    <>
    
    <div className="players-panel">
      <div className="players-map-side">
        <div
          className="players-map-container"
          style={{
            aspectRatio:
              mapWidth && mapHeight ? `${mapWidth} / ${mapHeight}` : undefined,
          }}
        >
          {!imgError ? (
            <img
              src={mapImageUrl}
              alt={`${match.map} minimap`}
              className="players-map-bg"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="players-map-placeholder">
              <span>Map not found</span>
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
                className="player-dot"
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  borderColor: color,
                  background: color,
                }}
                title={`${p.playerName} (Team ${p.team})`}
              >
                <span className="player-dot-label" style={{ color }}>
                  {p.playerName}
                </span>
              </div>
            );
          })}
        </div>
        <div className="players-map-name">{match.map}</div>
      </div>

      <div className="players-roster">
        {teams.map(
          (team) =>
            team.positions.length > 0 && (
              <div key={team.key} className="roster-team">
                <div
                  className="roster-team-header"
                  style={{ borderLeftColor: team.color }}
                >
                  {team.label}
                </div>
                <ul className="roster-list">
                  {team.positions.map((p, i) => {
                    const color = p.color ?? team.color;
                    return (
                      <li key={`${p.playerName}-${i}`} className="roster-entry">
                        <span
                          className="roster-dot"
                          style={{ background: color }}
                        />
                        <span className="roster-name" style={{ color }}>
                          {p.playerName}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ),
        )}
      </div>
    </div>
    </>
  );
}
