import { useState } from "react";
import { ChevronDown, ChevronRight, Save, Trash2 } from "lucide-react";
import { MILESTONES, COLORS, GAMEMODES } from "../../utils/globalVars";
import { MatchDetail } from "../MatchDetail/MatchDetail.jsx";
import { ScoreDial } from "../ui/ScoreDial.jsx";
import { Badge } from "../ui/Badge.jsx";
import { MiniSparkline } from "../ui/MiniSparkline.jsx";
import "./MatchCard.css";

export function MatchCard({
  match,
  analysis,
  expanded,
  isSaved,
  onToggle,
  onSave,
  onDelete,
}) {
  const activeMilestones = MILESTONES.filter((m) => analysis.flags[m.key]);

  return (
    <article className="match-container">
      {isSaved ? (
        <Trash2
          size={16}
          color={COLORS.combat}
          onClick={onDelete}
          className="save-action"
        />
      ) : (
        <Save
          size={16}
          color={COLORS.eco}
          onClick={onSave}
          className="save-action"
        />
      )}
      <button onClick={onToggle} className="show-detail">
        <ScoreDial score={analysis.score} />
        <header className="title-container">
          <div className="title-info">
            <span className="title-map">{match.map}</span>
            <span className="title-detail">
              {GAMEMODES[match.gamemode]} · {match.durationMin}m ·{" "}
              {match.playerCount}p
            </span>
          </div>
          <section className="badge-container">
            {activeMilestones.length > 0 ? (
              activeMilestones.map((m) => (
                <Badge
                  key={m.key}
                  def={m}
                  magnitude={analysis.magnitudes[m.key]}
                />
              ))
            ) : (
              <span className="no-badge">no milestones fired</span>
            )}
          </section>
        </header>
        <div className="miniSparkline-container">
          <MiniSparkline series={match.series} winner={match.winner} />
          {expanded ? (
            <ChevronDown size={16} color={COLORS.muted} />
          ) : (
            <ChevronRight size={16} color={COLORS.muted} />
          )}
        </div>
      </button>
      {expanded && <MatchDetail match={match} analysis={analysis} />}
    </article>
  );
}
