import { COLORS } from "../../utils/globalVars.js";

export function MiniSparkline({ series, width = 220, height = 46}) {
  const w = width,
    h = height,
    mid = h / 2;
  const pts = series.map((p, i) => {
    const x = (i / (series.length - 1)) * w;
    const y = mid - (p.leadPct - 0.5) * (h - 6) * 2;
    return [x, y];
  });
  const path = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
      <line
        x1={0}
        y1={mid}
        x2={w}
        y2={mid}
        stroke={COLORS.line}
        strokeWidth="1"
        strokeDasharray="2 3"
      />
      <path
        d={path}
        fill="none"
        stroke={COLORS.eco}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={pts[pts.length - 1][0]}
        cy={pts[pts.length - 1][1]}
        r="3"
        fill={COLORS.eco}
      />
    </svg>
  );
}
