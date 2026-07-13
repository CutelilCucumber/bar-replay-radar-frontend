import { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  Save,
  Trash2,
  FileWarningIcon,
} from "lucide-react";

import { MILESTONES } from "../../utils/awards.js";
import { COLORS, GAMEMODES } from "../../utils/globalVars";
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
  const [showWinner, setShowWinner] = useState(false);
  const [showAwards, setShowAwards] = useState(false);
  const [flipGraphs, setFlipGraphs] = useState(true);

  useEffect(() => {
    if (showWinner === true) {
      setFlipGraphs(false);
    } else {
      const flipped = Math.random() < 0.5;
      setFlipGraphs(flipped);
    }
  }, [showWinner]);

  const activeMilestones = MILESTONES.filter((m) => analysis.flags[m.key]);
  const unsupported =
    match.gamemode === "4" || match.gamemode === "5" ? true : false;

  return (
    <article className="match-container">
      {unsupported ? (
        <output className="warning-container">
          <FileWarningIcon
            size={15}
            color={COLORS.upset}
            style={{ flexShrink: 0, marginTop: 1 }}
          />
          <span className="warning-message">
            {GAMEMODES[match.gamemode]} not supported. Details may be incorrect
          </span>
        </output>
      ) : (
        ""
      )}
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
              {match.playerCount}p · {Math.round(match.averageOS * 100) / 100}os
            </span>
            <span className="title-detail">
              {formatDateLocalTimezone(match.startTime)}
            </span>
          </div>
          {showAwards ? (
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
                <span className="no-badge">Nothing noteworthy detected</span>
              )}
            </section>
          ) : (
            <div
              className="awards-show"
              onClick={(e) => {
                setShowAwards(true);
                e.stopPropagation();
              }}
            >{`Show ${activeMilestones.length} awards >`}</div>
          )}
          {showWinner ? (
            ""
          ) : (
            <div
              className="winner-show"
              onClick={(e) => {
                setShowWinner(true);
                e.stopPropagation();
              }}
            >{`Spoil results >`}</div>
          )}
        </header>
        <div className="miniSparkline-container">
          <MiniSparkline
            series={match.series}
            winner={showWinner ? match.winner : null}
            flipped={flipGraphs}
          />
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

function formatDateLocalTimezone(isoString) {
  // Parse the ISO string into a Date object
  const date = new Date(isoString);

  // Check if the date is valid
  if (isNaN(date.getTime())) {
    throw new Error("Invalid ISO 8601 timestamp");
  }

  // Format the date as YYYY-MM-DD
  const datePart = date
    .toLocaleDateString("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .replace(/\//g, "-");

  // Get the timezone abbreviation (e.g., PDT, EST)
  const timezone = date.toLocaleTimeString("en-US", { timeZoneName: "short" });

  // Combine all parts
  return `${datePart} ${timezone}`;
}
