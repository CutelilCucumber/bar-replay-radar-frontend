import { Fragment } from "react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  LabelList,
  ResponsiveContainer,
} from "recharts";
import { COLORS } from "../../utils/globalVars.js";
import { frameToTime, formatUnitName } from "../../utils/medals.js";
import { getUnitImageUrl } from "../../utils/mapImages.js";
import "./MedalsPanel.css";

// Damage values are rounded to the nearest integer so the page never shows
// fractional dmg from the source event data.
const roundDamage = (v) => Math.round(v).toLocaleString();

// Round a value up to 2 significant digits with trailing zeros so the bar
// axis max is a clean number (e.g. 4005 -> 4100, 3778 -> 3800).
const ceilTo2Sig = (v) => {
  if (!v) return 0;
  const place = Math.pow(10, Math.floor(Math.log10(v)) - 1);
  return Number((Math.ceil(v / place) * place).toPrecision(6));
};

// Config-driven sections. Each section has ONE primary metric that drives the
// single center bar chart (dmg/cost, dmg, dmg taken, dmg), plus the stats
// that fill the right-hand table columns.
const SECTIONS = [
  {
    key: "damageEfficiency",
    label: "Damage Efficiency",
    primary: {
      label: "Damage / Cost",
      value: (e) => {
        const cost = Number(e.metalCost ?? 0);
        const dmg = Number(e.damageDealt ?? 0);
        return cost > 0 ? dmg / cost : dmg;
      },
      format: (v) => `${v.toFixed(1)} dmg/cost`,
    },
    stats: [
      { key: "kills", label: "Kills", format: (v) => `${v}`, unit: "" },
      { key: "metalCost", label: "Cost", format: (v) => v.toLocaleString(), unit: "m" },
      { key: "damageDealt", label: "Damage", format: (v) => roundDamage(v), unit: "" },
      { key: "buildFrame", label: "Built", format: (v) => frameToTime(v) },
      { key: "destroyedFrame", label: "Died", format: (v) => frameToTime(v), fallback: "--:--" },
    ],
  },
  {
    key: "damageDealt",
    label: "Damage Dealt",
    primary: {
      label: "Damage",
      value: (e) => Number(e.damageDealt ?? 0),
      format: (v) => `${roundDamage(v)} dmg`,
    },
    stats: [
      { key: "kills", label: "Kills", format: (v) => `${v}`, unit: "kills" },
      { key: "metalCost", label: "Cost", format: (v) => v.toLocaleString(), unit: "m" },
      { key: "buildFrame", label: "Built", format: (v) => frameToTime(v) },
      { key: "destroyedFrame", label: "Died", format: (v) => frameToTime(v), fallback: "--:--" },
    ],
  },
  {
    key: "damageTaken",
    label: "Damage Taken",
    primary: {
      label: "Damage Taken",
      value: (e) => Number(e.totalDamageTaken ?? 0),
      format: (v) => roundDamage(v),
    },
    stats: [
      { key: "totalDamageTaken", label: "Taken", format: (v) => roundDamage(v), unit: "dmg" },
      { key: "damageDealt", label: "Dealt", format: (v) => roundDamage(v), unit: "dmg" },
      { key: "buildFrame", label: "Built", format: (v) => frameToTime(v) },
      { key: "destroyedFrame", label: "Died", format: (v) => frameToTime(v), fallback: "--:--" },
    ],
  },
  {
    key: "veteranUnits",
    label: "Veteran Units",
    primary: {
      label: "Damage",
      value: (e) => Number(e.damageDealt ?? 0),
      format: (v) => `${roundDamage(v)} dmg`,
    },
    stats: [
      { key: "kills", label: "Kills", format: (v) => `${v}`, unit: "kills" },
      { key: "damageDealt", label: "Damage", format: (v) => roundDamage(v), unit: "" },
      { key: "buildFrame", label: "Built", format: (v) => frameToTime(v) },
      { key: "destroyedFrame", label: "Died", format: (v) => frameToTime(v), fallback: "--:--" },
    ],
  },
];

// Rank color, not opacity: #1 gold, #2 silver, #3 bronze.
const RANK_META = {
  1: { color: "#f2c94c" },
  2: { color: "#c9d4e0" },
  3: { color: "#d18a54" },
};

const DEFAULT_UNIT_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect fill='%23333' width='64' height='64'/%3E%3Ctext x='32' y='38' font-size='10' fill='%23666' text-anchor='middle' font-family='monospace'%3E?%3C/text%3E%3C/svg%3E";

// Prefer the baked-in player color; fall back to the team's flat color so
// records without color data still render (mirrors AwardsPanel).
function displayColor(entry) {
  if (entry?.color) return entry.color;
  return entry?.allyTeam === "A" ? COLORS.close : COLORS.combat;
}

function formatStatValue(stat, raw) {
  if (raw == null) return stat.fallback ?? "—";
  return `${stat.format(raw)}${stat.unit ? ` ${stat.unit}` : ""}`;
}

export function MedalsPanel({ medals }) {
  if (!medals) {
    return <div className="panel-empty">No medal data available for this match.</div>;
  }

  return (
    <div className="medals-panel">
      {SECTIONS.map((section) => {
        const entries = medals[section.key];
        if (!entries || entries.length === 0) return null;
        return <MedalSection key={section.key} section={section} entries={entries} />;
      })}
    </div>
  );
}

function MedalSection({ section, entries }) {
  const { primary } = section;
  const rowHeight = "var(--medal-row-h)";
  const rows = entries.length;

  const max = Math.max(1, ...entries.map((e) => primary.value(e)));
  const chartMax = ceilTo2Sig(max);
  const chartData = entries.map((entry) => {
    const raw = primary.value(entry);
    return { entry, key: entry.unitID, value: raw, display: primary.format(raw) };
  });

  const tableColumns = `minmax(70px, 1.2fr) repeat(${section.stats.length}, minmax(64px, 1fr))`;

  return (
    <section className="medal-section">
      <h5 className="medal-section-title">{section.label}</h5>
      {/*
        Three columns: image column (1), ONE center bar chart (2) spanning all
        entry rows, and the stat table (3). Every grid row is --medal-row-h tall
        (except the 28px header row), and the chart is exactly rows * row-h so
        its bars sit inline with the adjacent image and table rows.
      */}
      <div
        className="medal-section-body"
        style={{ gridTemplateRows: `28px repeat(${rows}, ${rowHeight})` }}
      >
        <div className="medal-col-head medal-col-head-empty" style={{ gridColumn: 1, gridRow: 1 }} />
        <div className="medal-col-head medal-chart-head" style={{ gridColumn: 2, gridRow: 1 }}>
          {primary.label}
        </div>
        <div className="medal-col-head" style={{ gridColumn: 3, gridRow: 1 }}>
          <div className="medal-table-row medal-table-head" style={{ gridTemplateColumns: tableColumns }}>
            <span className="medal-table-player">Player</span>
            {section.stats.map((s) => (
              <span key={s.key} className="medal-table-stat">{s.label}</span>
            ))}
          </div>
        </div>

        {entries.map((entry, i) => (
          <Fragment key={entry.unitID}>
            <div className="medal-media" style={{ gridColumn: 1, gridRow: i + 2 }}>
              <EntryMedia entry={entry} rank={i + 1} />
            </div>
            <div className="medal-table-row" style={{ gridColumn: 3, gridRow: i + 2 }}>
              <span className="medal-table-player" style={{ color: displayColor(entry) }}>
                {entry.playerName}
              </span>
              {section.stats.map((s) => (
                <span key={s.key} className="medal-table-stat">
                  {formatStatValue(s, entry[s.key])}
                </span>
              ))}
            </div>
          </Fragment>
        ))}

        <div
          className="medal-chart"
          style={{
            gridColumn: 2,
            gridRow: `2 / span ${rows}`,
            height: `calc(${rowHeight} * ${rows})`,
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 64, bottom: 4, left: 0 }}
            >
              
              <XAxis type="number" domain={[0, chartMax]} orientation="top" />
              <YAxis type="category" dataKey="key" hide />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={26}>
                {chartData.map((d) => (
                  <Cell key={d.key} fill={displayColor(d.entry)} />
                ))}
                <LabelList
                  dataKey="display"
                  position="right"
                  fill={COLORS.muted}
                  fontSize={10}
                  fontFamily="Roboto Mono"
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

function EntryMedia({ entry, rank }) {
  const color = displayColor(entry);
  const destroyed = entry.destroyedFrame != null;
  const rankColor = RANK_META[rank]?.color ?? COLORS.muted;

  return (
    <div className="medal-card-media">
      <img
        src={getUnitImageUrl(entry.definitionName)}
        alt={entry.definitionName}
        className="medal-card-image"
        loading="lazy"
        onError={(e) => {
          if (e.currentTarget.dataset.fallback === "1") return;
          e.currentTarget.dataset.fallback = "1";
          e.currentTarget.src = DEFAULT_UNIT_IMAGE;
        }}
      />
      <span className="medal-card-rank" style={{ color: rankColor }}>
        #{rank}
      </span>
      <div className="medal-card-identity">
        <span className="medal-card-unit-name" style={{ color }}>
          {formatUnitName(entry.definitionName)}
        </span>
        <span className={`medal-card-status ${destroyed ? "dead" : "alive"}`}>
          {destroyed ? "Destroyed" : "Survived"}
        </span>
      </div>
    </div>
  );
}