import { COLORS } from "../../utils/globalVars.js";
import awardDetails from "../../utils/awardDetails.json";
import "./AwardsPanel.css";

const AWARD_ORDER = [
  { key: "resourceDestroyer", meta: awardDetails["resource-destroyer"] },
  { key: "combatMaster", meta: awardDetails["combat-master"] },
  { key: "damageEfficiency", meta: awardDetails["damageEfficiency"] },
  { key: "traitor", meta: awardDetails["traitor"] },
];

const GOLDEN_COW_META = awardDetails["golden-cow"];

// Score formatting per award. Counts and damage/resources use thousands
// separators; efficiency is a small ratio.
function formatScore(key, value) {
  if (value == null) return "—";
  if (key === "damageEfficiency") return value.toFixed(2);
  return Math.round(value).toLocaleString();
}

// Prefer the baked-in player color; fall back to the team's flat color so
// records without color data still render.
function displayColor(entry) {
  if (entry?.color) return entry.color;
  return entry?.allyTeam === "A" ? COLORS.close : COLORS.combat;
}

export function AwardsPanel({ medals }) {
  if (!medals?.awards) {
    return <div className="panel-empty">No award data available for this match.</div>;
  }

  const { awards } = medals;
  const goldenCow = awards.goldenCow;
  const sub = awards.subAwards ?? {};

  return (
    <div className="awards-panel">
      <div className="awards-head">
        <span className="awards-title">Awards</span>
        <span className="awards-score-head">Score</span>
      </div>

      <div className="awards-list">
        {AWARD_ORDER.map(({ key, meta }) => {
          const award = awards[key];
          if (!award || !award.winner) return null;
          return <AwardRow key={key} awardKey={key} award={award} meta={meta} />;
        })}

        {goldenCow && (
          <div className="award-row golden-cow">
            <div className="award-img-slot">
              <img src={GOLDEN_COW_META.imgurl} alt="Golden Cow" loading="lazy" />
            </div>
            <div className="award-name-col">
              <span className="award-player" style={{ color: displayColor(goldenCow) }}>
                {goldenCow.playerName}
              </span>
              <span className="award-desc">{GOLDEN_COW_META.description}</span>
            </div>
          </div>
        )}
      </div>

      <div className="awards-sub">
        {sub.mostResources && (
          <div className="sub-award">
            <span style={{ color: displayColor(sub.mostResources) }}>
              {sub.mostResources.playerName}
            </span>{" "}
            produced the most resources (
            {Math.round(sub.mostResources.value).toLocaleString()})
          </div>
        )}
        {sub.mostDamageTaken && (
          <div className="sub-award">
            <span style={{ color: displayColor(sub.mostDamageTaken) }}>
              {sub.mostDamageTaken.playerName}
            </span>{" "}
            took the most damage (
            {Math.round(sub.mostDamageTaken.value).toLocaleString()})
          </div>
        )}
      </div>
    </div>
  );
}

function AwardRow({ awardKey, award, meta }) {
  const { winner, runnersUp } = award;
  const second = runnersUp?.[0];
  const third = runnersUp?.[1];

  return (
    <div className="award-row">
      <div className="award-img-slot">
        <img src={meta.imgurl} alt={meta.description} loading="lazy" />
      </div>

      <div className="award-name-col">
        <span className="award-player" style={{ color: displayColor(winner) }}>
          {winner.playerName}
        </span>
        <span className="award-desc">{meta.description}</span>
      </div>

      <div className="award-runners">
        <span className="runners-label">Runners up:</span>
        {second && (
          <span className="runner-name" style={{ color: displayColor(second) }}>
            {second.playerName}
          </span>
        )}
        {third && (
          <span className="runner-name" style={{ color: displayColor(third) }}>
            {third.playerName}
          </span>
        )}
      </div>

      <div className="award-scores">
        <span style={{ color: displayColor(winner) }}>
          {formatScore(awardKey, winner.value)}
        </span>
        {second && (
          <span style={{ color: displayColor(second) }}>
            {formatScore(awardKey, second.value)}
          </span>
        )}
        {third && (
          <span style={{ color: displayColor(third) }}>
            {formatScore(awardKey, third.value)}
          </span>
        )}
      </div>
    </div>
  );
}
