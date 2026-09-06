import { useMemo } from "react";
import { MILESTONES } from "../../utils/awards.js";
import { Trophy, Users, Award, Boxes } from "lucide-react";
import "./InfoSidebar.css";

const TOP_N = 6;
const MEDAL_RANK_POINTS = [3, 2, 1]; // 1st / 2nd / 3rd place weighting

/**
 * Left-docked, always-visible aggregate panel over whatever match list is
 * currently filtered/displayed. Every row is clickable and calls
 * onSelectMatch(matchId) with a representative example match for that stat,
 * so clicking "Comeback ×5" jumps to the highest-scoring match that had it.
 */
export function InfoSidebar({ matches, onSelectMatch }) {
  const awardCounts = useMemo(() => summarizeAwards(matches), [matches]);
  const topPlayers = useMemo(() => summarizePlayerGames(matches), [matches]);
  const topAwardedPlayers = useMemo(() => summarizePlayerAwards(matches), [matches]);
  const topUnits = useMemo(() => summarizeUnitMedals(matches), [matches]);

  const hasPlayerData = matches.some(
    (m) => (m.teamA?.players?.length ?? 0) + (m.teamB?.players?.length ?? 0) > 0,
  );
  const hasMedalData = matches.some((m) => m.medals);

  return (
    <aside className="info-sidebar">
      <div className="info-sidebar-header">
        <span>Batch Overview</span>
        <span className="info-sidebar-count">{matches.length} matches</span>
      </div>

      <InfoSection icon={Trophy} title="Most common awards">
        {awardCounts.length === 0 ? (
          <EmptyRow text="No matches loaded." />
        ) : (
          awardCounts.map((row) => (
            <InfoRow
              key={row.key}
              icon={row.icon}
              color={row.color}
              label={row.label}
              value={`${row.count}×`}
              onClick={row.exampleMatchId ? () => onSelectMatch(row.exampleMatchId) : null}
            />
          ))
        )}
      </InfoSection>

      <InfoSection icon={Users} title="Most games played">
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
              onClick={() => onSelectMatch(row.exampleMatchId)}
            />
          ))
        )}
      </InfoSection>

      <InfoSection icon={Award} title="Most awarded players">
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
              onClick={() => onSelectMatch(row.exampleMatchId)}
            />
          ))
        )}
      </InfoSection>

      <InfoSection icon={Boxes} title="Best-medaled units">
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
              onClick={() => onSelectMatch(row.exampleMatchId)}
            />
          ))
        )}
      </InfoSection>
    </aside>
  );
}

function InfoSection({ icon: Icon, title, children }) {
  return (
    <section className="info-section">
      <h5 className="info-section-title">
        <Icon size={13} /> {title}
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
    const players = [...(m.teamA?.players ?? []), ...(m.teamB?.players ?? [])];
    for (const p of players) {
      const name = p.name ?? p.username;
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
  const tally = new Map();
  for (const m of matches) {
    const awardCount = MILESTONES.reduce((sum, ms) => sum + (m[ms.key] ? 1 : 0), 0);
    if (awardCount === 0) continue;
    const players = [...(m.teamA?.players ?? []), ...(m.teamB?.players ?? [])];
    for (const p of players) {
      const name = p.name ?? p.username;
      if (!name) continue;
      const entry = tally.get(name) ?? { count: 0, exampleMatchId: m.id };
      entry.count += awardCount;
      tally.set(name, entry);
    }
  }
  return [...tally.entries()]
    .map(([name, entry]) => ({ name, count: entry.count, exampleMatchId: entry.exampleMatchId }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_N);
}

function summarizeUnitMedals(matches) {
  const tally = new Map(); // definitionName -> { points, exampleMatchId, bestRank }
  for (const m of matches) {
    if (!m.medals) continue;
    for (const section of Object.values(m.medals)) {
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