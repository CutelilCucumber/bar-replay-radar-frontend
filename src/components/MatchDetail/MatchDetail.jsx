import { useState, useEffect } from "react";
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
  {
    key: "armyDiff",
    title: "Army Value Difference",
    color: COLORS.eco,
    unit: "M",
  },
  {
    key: "ecoDiff",
    title: "Eco Value Difference",
    color: COLORS.close,
    unit: "M",
  },
  {
    key: "dmgDiff",
    title: "Damage Dealt Difference",
    color: COLORS.combat,
    unit: "DMG",
  },
  {
    key: "actionsDiff",
    title: "APM Difference",
    color: COLORS.upset,
    unit: "APM",
  },
];

export function MatchDetail({ match, analysis, flipGraphs }) {
  const [diffData, setDiffData] = useState(
    match.series.map((p) => ({
      t: p.t,
      armyDiff: (p.armyA ?? 0) - (p.armyB ?? 0),
      ecoDiff: (p.ecoA ?? 0) - (p.ecoB ?? 0),
      dmgDiff: (p.dmgA ?? 0) - (p.dmgB ?? 0),
      actionsDiff: (p.actionsA ?? 0) - (p.actionsB ?? 0),
    })),
  );
  const { details } = analysis;

  // one shared array of per-minute diffs, feeding all 4 charts below
  useEffect(() => {
    if (flipGraphs) {
      setDiffData(
        match.series.map((p) => ({
          t: p.t,
          armyDiff: (p.armyB ?? 0) - (p.armyA ?? 0),
          ecoDiff: (p.ecoB ?? 0) - (p.ecoA ?? 0),
          dmgDiff: (p.dmgB ?? 0) - (p.dmgA ?? 0),
          actionsDiff: (p.actionsB ?? 0) - (p.actionsA ?? 0),
        })),
      );
    } else {
      setDiffData(
        match.series.map((p) => ({
          t: p.t,
          armyDiff: (p.armyA ?? 0) - (p.armyB ?? 0),
          ecoDiff: (p.ecoA ?? 0) - (p.ecoB ?? 0),
          dmgDiff: (p.dmgA ?? 0) - (p.dmgB ?? 0),
          actionsDiff: (p.actionsA ?? 0) - (p.actionsB ?? 0),
        })),
      );
    }
  }, [flipGraphs]);

  return (
    <div className="detail-container">
      <div
        className="chart-grid"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
      >
        {CHARTS.map((chart) => (
          <DiffChart
            key={chart.key}
            id={`${match.id}-${chart.key}`}
            title={chart.title}
            data={diffData}
            dataKey={chart.key}
            color={chart.color}
            unit={chart.unit}
          />
        ))}
      </div>
      <section className="stat-container">
        <Stat
          label="Biggest comeback:"
          value={`${Math.round(details.worstDeficit)}m army value`}
          color={COLORS.eco}
        />
        <Stat
          label="Final Damage gap:"
          value={`${Math.round(details.finalDmgGap)} damage`}
          color={COLORS.combat}
        />
        <Stat
          label="Team skill gap:"
          value={`${details.skillGap.toFixed(2)} OS`}
          color={COLORS.upset}
        />
        <Stat
          label="Highest Damage Moment:"
          value={`${details.highestDamageMinute} minutes`}
          color={COLORS.combat}
        />
        <Stat
          label="surviving Commanders:"
          value={`${details.commandersLeft}`}
          color={COLORS.close}
        />
        <Stat
          label="Unit type diversity:"
          value={`${details.uniqueUnits}`}
          color={COLORS.close}
        />
        <Stat
          label="First AFUS Timing:"
          value={
            details.firstAfus
              ? `${details.firstAfus.toFixed(2)} minutes`
              : "none"
          }
          color={COLORS.close}
        />
        <Stat
          label="First Gantry Timing:"
          value={
            details.firstT3Minute
              ? `${details.firstT3Minute.toFixed(2)} minutes`
              : "none"
          }
          color={COLORS.combat}
        />
        <Stat
          label="First Nuke Timing:"
          value={
            details.firstNuke
              ? `${details.firstNuke.toFixed(2)} minutes`
              : "none"
          }
          color={COLORS.combat}
        />
        <Stat
          label="First RFLRPC Timing:"
          value={
            details.firstRFLRPC
              ? `${details.firstRFLRPC.toFixed(2)} minutes`
              : "none"
          }
          color={COLORS.close}
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
function DiffChart({ id, title, data, dataKey, color, unit }) {
  const maxAbs = Math.max(1, ...data.map((p) => Math.abs(p[dataKey])));

  return (
    <section className="chart-container">
      <div
        className="chart-title"
        style={{ fontSize: 11, color: COLORS.muted, marginBottom: 2 }}
      >
        {title}
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
        >
          <defs>
            <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="t"
            tick={{
              fill: COLORS.muted,
              fontSize: 10,
              fontFamily: "JetBrains Mono",
            }}
            axisLine={{ stroke: COLORS.line }}
            tickLine={false}
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
              `${v >= 0 ? "+" : ""}${Math.round(v)} ${v >= 0 ? "Blue team lead" : "Red team lead"}`,
              "",
            ]}
            labelFormatter={(t) => `${unit} at ${t} minutes.`}
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
