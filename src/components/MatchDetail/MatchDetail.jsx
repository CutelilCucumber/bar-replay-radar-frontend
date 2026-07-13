import { COLORS } from "../../utils/globalVars.js";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ExternalLink } from "lucide-react";
import { Stat } from "../ui/Stat.jsx";
import "./MatchDetail.css";

const CHARTS = [
  { key: "armyDiff", title: "Army Value Difference", color: COLORS.eco, unit: "" },
  { key: "ecoDiff", title: "Eco Value Difference", color: COLORS.close, unit: "" },
  { key: "dmgDiff", title: "Damage Dealt Difference", color: COLORS.combat, unit: "" },
  { key: "actionsDiff", title: "APM Difference", color: COLORS.upset, unit: "" },
];

export function MatchDetail({ match, analysis }) {
  const { details } = analysis;

  // one shared array of per-minute diffs, feeding all 4 charts below
  const diffData = match.series.map((p) => ({
    t: p.t,
    armyDiff: (p.armyA ?? 0) - (p.armyB ?? 0),
    ecoDiff: (p.ecoA ?? 0) - (p.ecoB ?? 0),
    dmgDiff: (p.dmgA ?? 0) - (p.dmgB ?? 0),
    actionsDiff: (p.actionsA ?? 0) - (p.actionsB ?? 0),
  }));

  return (
    <div className="detail-container">
      <div className="chart-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {CHARTS.map((chart) => (
          <DiffChart
            key={chart.key}
            id={`${match.id}-${chart.key}`}
            title={chart.title}
            data={diffData}
            dataKey={chart.key}
            color={chart.color}
            teamAName={match.teamA.name}
            teamBName={match.teamB.name}
          />
        ))}
      </div>
      <section className="stat-container">
        <Stat
          label="Winner's worst deficit"
          value={`${Math.round(details.worstDeficit * 100)}% army share`}
          color={COLORS.eco}
        />
        <Stat
          label="Final army gap"
          value={`${Math.round(details.finalLeadGap * 100)}%`}
          color={COLORS.close}
        />
        <Stat
          label="Skill gap (ally teams)"
          value={details.skillGap.toFixed(1)}
          color={COLORS.upset}
        />
        <Stat
          label="Momentum shifts"
          value={details.momentumShifts}
          color={COLORS.combat}
        />
      </section>
      <a
        href={`https://gex.honu.pw/match/${match.id}`}
        target="_blank"
        rel="noreferrer"
        className="link"
      >
        Open in Gex <ExternalLink size={13} />
      </a>
      <a
        href={`https://www.beyondallreason.info/replays?gameId=${match.id}`}
        target="_blank"
        rel="noreferrer"
        className="link"
      >
        Replay Page <ExternalLink size={13} />
      </a>
    </div>
  );
}

/**
 * One small comparative chart: a single `dataKey` diff series (team A minus
 * team B), drawn symmetrically around a zero midline so "who's ahead" reads
 * as above/below center rather than needing a legend.
 */
function DiffChart({ id, title, data, dataKey, color, teamAName, teamBName }) {
  const maxAbs = Math.max(1, ...data.map((p) => Math.abs(p[dataKey])));

  return (
    <section className="chart-container">
      <div className="chart-title" style={{ fontSize: 11, color: COLORS.muted, marginBottom: 2 }}>
        {title}
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="t"
            tick={{ fill: COLORS.muted, fontSize: 10, fontFamily: "JetBrains Mono" }}
            axisLine={{ stroke: COLORS.line }}
            tickLine={false}
            unit="m"
          />
          <YAxis domain={[-maxAbs, maxAbs]} hide />
          <ReferenceLine y={0} stroke={COLORS.line} strokeDasharray="2 3" />
          <Tooltip
            contentStyle={{
              background: COLORS.panel,
              border: `1px solid ${COLORS.line}`,
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: COLORS.muted }}
            formatter={(v) => [
              `${v >= 0 ? "+" : ""}${Math.round(v)} ${v >= 0 ? teamAName : teamBName}`,
              "",
            ]}
            labelFormatter={(t) => `minute ${t}`}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            fill={`url(#grad-${id})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </section>
  );
}
