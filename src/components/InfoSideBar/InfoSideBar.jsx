import { useMemo } from "react";
import { MILESTONES } from "../../utils/milestones.js";
import { Trophy, Users, Award, Boxes, X } from "lucide-react";
import "./InfoSideBar.css";

const TOP_N = 6;
const MEDAL_RANK_POINTS = [3, 2, 1]; // 1st / 2nd / 3rd place weighting

/**
 * Left-docked, always-visible aggregate panel over whatever match list is
 * currently filtered/displayed. Every row is clickable and calls
 * onSelectMatch(matchId) with a representative example match for that stat,
 * so clicking "Comeback ×5" jumps to the highest-scoring match that had it.
 */
export function InfoSidebar({ matches, onSelectMatch, open, onOpenChange }) {
  const awardCounts = useMemo(() => summarizeAwards(matches), [matches]);
  const topPlayers = useMemo(() => summarizePlayerGames(matches), [matches]);
  const topAwardedPlayers = useMemo(() => summarizePlayerAwards(matches), [matches]);
  const topUnits = useMemo(() => summarizeUnitMedals(matches), [matches]);

  const hasPlayerData = matches.some((m) => getPlayers(m).length > 0);
  const hasMedalData = matches.some((m) => m.medals);

  return (
    <>
      {open && <div className="info-sidebar-scrim" onClick={() => onOpenChange(false)} />}

      <aside className={`info-sidebar ${open ? "open" : ""}`}>
        <div className="info-sidebar-header">
          <span>Batch Overview</span>
          <button className="info-sidebar-close" onClick={() => onOpenChange(false)} aria-label="Close batch overview">
            <X size={16} />
          </button>
          <span className="info-sidebar-count">{matches.length} matches</span>
        </div>

      <InfoSection title="Most common Milestones">
        {awardCounts.length === 0 ? (
          <EmptyRow text="No matches loaded." />
        ) : (
          awardCounts.map((row) => (
            <InfoRow
              key={row.key}
              color={row.color}
              label={row.label}
              value={`${row.count}×`}
              onClick={row.exampleMatchId ? () => onSelectMatch(row.exampleMatchId, "awards") : null}
            />
          ))
        )}
      </InfoSection>

      <InfoSection title="Most games played">
        {!hasPlayerData ? (
          <EmptyRow text="Player roster data isn't available yet." />
        ) : topPlayers.length === 0 ? (
          <EmptyRow text="No player data in this batch." />
        ) : (
          topPlayers.map((row) => (
            <InfoRow
              key={row.name}
              label={row.name}
              value={`${row.count} games`}
              onClick={() => onSelectMatch(row.exampleMatchId, "players")}
            />
          ))
        )}
      </InfoSection>

      <InfoSection title="Most awarded players">
        {!hasPlayerData ? (
          <EmptyRow text="Player roster data isn't available yet." />
        ) : topAwardedPlayers.length === 0 ? (
          <EmptyRow text="No awards in this batch." />
        ) : (
          topAwardedPlayers.map((row) => (
            <InfoRow
              key={row.name}
              label={row.name}
              value={`${row.count} awards`}
              onClick={() => onSelectMatch(row.exampleMatchId, "awards")}
            />
          ))
        )}
      </InfoSection>

      <InfoSection title="Best-medaled units">
        {!hasMedalData ? (
          <EmptyRow text="Medal data isn't available for these matches yet." />
        ) : topUnits.length === 0 ? (
          <EmptyRow text="No medals in this batch." />
        ) : (
          topUnits.map((row) => (
            <InfoRow
              key={row.definitionName}
              label={row.definitionName}
              value={`${row.points} pts`}
              onClick={() => onSelectMatch(row.exampleMatchId, "medals")}
            />
          ))
        )}
      </InfoSection>
    </aside>
  </>
  );
}

function InfoSection({ title, children }) {
  return (
    <section className="info-section">
      <h5 className="info-section-title">
         {title}
      </h5>
      <div className="info-section-rows">{children}</div>
    </section>
  );
}

function InfoRow({ icon: Icon, color, label, value, onClick }) {
  return (
    <button className="info-row" onClick={onClick ?? undefined} disabled={!onClick}>
      {Icon && <Icon size={12} color={color ? `var(${color})` : undefined} />}
      <span className="info-row-label">{label}</span>
      <span className="info-row-value">{value}</span>
    </button>
  );
}

function EmptyRow({ text }) {
  return <div className="info-row-empty">{text}</div>;
}

// --- aggregation helpers -------------------------------------------------

function summarizeAwards(matches) {
  const tally = new Map(); // milestoneKey -> { count, best: {score, id} }
  for (const m of matches) {
    for (const milestone of MILESTONES) {
      if (!m[milestone.key]) continue;
      const entry = tally.get(milestone.key) ?? { count: 0, best: null };
      entry.count += 1;
      if (!entry.best || (m.score ?? 0) > entry.best.score) {
        entry.best = { score: m.score ?? 0, id: m.id };
      }
      tally.set(milestone.key, entry);
    }
  }
  return [...tally.entries()]
    .map(([key, entry]) => {
      const milestone = MILESTONES.find((m) => m.key === key);
      return {
        key,
        label: milestone?.label ?? key,
        icon: milestone?.icon,
        color: milestone?.color,
        count: entry.count,
        exampleMatchId: entry.best?.id,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_N);
}

function summarizePlayerGames(matches) {
  const tally = new Map(); // playerName -> { count, exampleMatchId }
  for (const m of matches) {
    for (const p of getPlayers(m)) {
      const name = p.playerName;
      if (!name) continue;
      const entry = tally.get(name) ?? { count: 0, exampleMatchId: m.id };
      entry.count += 1;
      tally.set(name, entry);
    }
  }
  return [...tally.entries()]
    .map(([name, entry]) => ({ name, count: entry.count, exampleMatchId: entry.exampleMatchId }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_N);
}

/**
 * PLACEHOLDER ATTRIBUTION: milestones are computed per MATCH, not per
 * player, so this currently credits every flagged milestone in a match to
 * every player who played in it (both teams). That over-counts relative to
 * "this specific player achieved the comeback" and doesn't distinguish
 * winner-specific milestones (comeback, nailBiter) from match-wide ones
 * (stomp, bigBattle). Needs a real per-milestone attribution rule once
 * that's decided — see agent instructions doc.
 */
function summarizePlayerAwards(matches) {
  // Prefer real per-player award wins (same source as the Awards tab) so each
  // player's row jumps to the match where they personally earned the most
  // awards. Fall back to placeholder match-level milestone attribution only
  // when no award data is present at all.
  if (matches.some((m) => m.medals?.awards)) {
    return summarizePlayerAwardWins(matches);
  }
  return summarizePlayerAwardsMilestones(matches);
}

const AWARD_KEYS = ["resourceDestroyer", "combatMaster", "damageEfficiency", "traitor"];
const SUB_AWARD_KEYS = ["mostResources", "mostDamageTaken"];

function summarizePlayerAwardWins(matches) {
  const tally = new Map(); // name -> { count, bestMatch: { id, count } }
  for (const m of matches) {
    const awards = m.medals?.awards;
    if (!awards) continue;
    const perPlayer = new Map(); // name -> awards won in THIS match
    const credit = (entry) => {
      const name = entry?.playerName;
      if (name) perPlayer.set(name, (perPlayer.get(name) ?? 0) + 1);
    };
    if (awards.goldenCow) credit(awards.goldenCow);
    for (const key of AWARD_KEYS) credit(awards[key]?.winner);
    for (const key of SUB_AWARD_KEYS) credit(awards.subAwards?.[key]);
    for (const [name, count] of perPlayer) {
      const entry = tally.get(name) ?? { count: 0, bestMatch: null };
      entry.count += count;
      if (!entry.bestMatch || count > entry.bestMatch.count) {
        entry.bestMatch = { id: m.id, count };
      }
      tally.set(name, entry);
    }
  }
  return [...tally.entries()]
    .map(([name, entry]) => ({ name, count: entry.count, exampleMatchId: entry.bestMatch?.id }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_N);
}

/**
 * PLACEHOLDER ATTRIBUTION: milestones are computed per MATCH, not per
 * player, so this credits every flagged milestone in a match to every player
 * who played in it (both teams). Only used when no per-player award data
 * exists.
 */
function summarizePlayerAwardsMilestones(matches) {
  const tally = new Map();
  for (const m of matches) {
    const awardCount = MILESTONES.reduce((sum, ms) => sum + (m[ms.key] ? 1 : 0), 0);
    if (awardCount === 0) continue;
    for (const p of getPlayers(m)) {
      const name = p.playerName;
      if (!name) continue;
      const entry = tally.get(name) ?? { count: 0, bestMatch: null };
      entry.count += awardCount;
      if (!entry.bestMatch || awardCount > entry.bestMatch.awardCount) {
        entry.bestMatch = { id: m.id, awardCount };
      }
      tally.set(name, entry);
    }
  }
  return [...tally.entries()]
    .map(([name, entry]) => ({ name, count: entry.count, exampleMatchId: entry.bestMatch?.id }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_N);
}

/**
 * Roster comes from each team's start positions (same source as the Players
 * tab) rather than a baked-in `players` array, which is empty on list
 * responses.
 */
function getPlayers(match) {
  const a = match.teamA?.facts?.startPositions ?? [];
  const b = match.teamB?.facts?.startPositions ?? [];
  return [...a, ...b];
}

function summarizeUnitMedals(matches) {
  const tally = new Map(); // definitionName -> { points, exampleMatchId, bestRank }
  const medalSections = ["damageEfficiency", "damageDealt", "damageTaken", "veteranUnits"];
  for (const m of matches) {
    if (!m.medals) continue;
    for (const sectionKey of medalSections) {
      const section = m.medals[sectionKey];
      if (!Array.isArray(section)) continue;
      section.forEach((entry, i) => {
        const points = MEDAL_RANK_POINTS[i] ?? 0;
        if (points === 0) return;
        const name = entry.definitionName;
        const existing = tally.get(name) ?? { points: 0, exampleMatchId: m.id, bestRank: i };
        existing.points += points;
        if (i < existing.bestRank) {
          existing.bestRank = i;
          existing.exampleMatchId = m.id;
        }
        tally.set(name, existing);
      });
    }
  }
  return [...tally.entries()]
    .map(([definitionName, entry]) => ({
      definitionName,
      points: entry.points,
      exampleMatchId: entry.exampleMatchId,
    }))
    .sort((a, b) => b.points - a.points)
    .slice(0, TOP_N);
}