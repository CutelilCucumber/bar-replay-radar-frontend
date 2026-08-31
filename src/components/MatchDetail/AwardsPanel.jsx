import { AWARD_LABELS } from "../../utils/medals.js";
import { Trophy, Swords } from "lucide-react";
import { COLORS } from "../../utils/globalVars.js";
import "./AwardsPanel.css";

const AWARD_ORDER = [
  "resourceDestroyer",
  "unitKiller",
  "defenseDestroyer",
  "damageEfficiency",
  "traitor",
];

export function AwardsPanel({ medals }) {
  if (!medals) {
    return <div className="panel-empty">No medal data available for this match.</div>;
  }

  const { awards } = medals;
  const goldenCow = awards.goldenCow;

  return (
    <div className="awards-panel">
      {goldenCow && (
        <div className="award-card golden-cow">
          <div className="award-icon-slot golden-cow-icon">
            <Trophy size={28} color={COLORS.upset} />
          </div>
          <div className="award-info">
            <span className="award-label">{AWARD_LABELS.goldenCow}</span>
            <span className="award-player">{goldenCow.playerName}</span>
            <span className="award-hint">Swept all combat awards</span>
          </div>
        </div>
      )}

      <div className="awards-grid">
        {AWARD_ORDER.map((key) => {
          const award = awards[key];
          if (!award || award.playerName === null) return null;

          return (
            <div key={key} className="award-card">
              <div className="award-icon-slot">
                <Swords size={20} color={COLORS.combat} />
              </div>
              <div className="award-info">
                <span className="award-label">{AWARD_LABELS[key]}</span>
                <span className="award-player">{award.playerName}</span>
                <span className="award-value">{formatAwardValue(key, award.value)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatAwardValue(key, value) {
  if (key === "damageEfficiency") return `${value.toFixed(2)}x efficiency`;
  if (key === "traitor") return `${value} friendly kills`;
  return `${value} destroyed`;
}
