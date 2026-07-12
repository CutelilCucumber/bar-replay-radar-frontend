import { COLORS } from "../../utils/globalVars";

export function ScoreDial({ score }) {
  const r = 22,
    c = 2 * Math.PI * r;
  const pct = score / 100;
  const color = numberToRgb(score);
  return (
    <div 
    title="Spectator score out of 100"
    style={{ position: "relative", width: 56, height: 56, flexShrink: 0 }}>
      <svg width="56" height="56" style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke={COLORS.line}
          strokeWidth="5"
        />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeDasharray={`${c * pct} ${c}`}
          strokeLinecap="round"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Orbitron",
          fontWeight: 600,
          fontSize: 15,
          color: COLORS.ink,
        }}
      >
        {score}
      </div>
    </div>
  );
}

function numberToRgb(value) {
  if (value === 0) return "#233029";

  // Define the breakpoints and their corresponding RGB values
  const breakpoints = [
    { value: 1, rgb: [35, 48, 41] }, // correspond to -line
    { value: 25, rgb: [80, 158, 180] }, // correspond to blue
    { value: 50, rgb: [90, 209, 90] }, // correspons to green
    { value: 75, rgb: [180, 150, 20] }, // corresponds to yellow
    { value: 100, rgb: [255, 0, 0] }, // Red at 100
  ];

  // Find the two closest breakpoints
  for (let i = 0; i < breakpoints.length - 1; i++) {
    if (value >= breakpoints[i].value && value <= breakpoints[i + 1].value) {
      const start = breakpoints[i];
      const end = breakpoints[i + 1];

      // Calculate the interpolation factor (0 to 1)
      const factor = (value - start.value) / (end.value - start.value);

      // Interpolate each RGB component
      const r = Math.round(start.rgb[0] + (end.rgb[0] - start.rgb[0]) * factor);
      const g = Math.round(start.rgb[1] + (end.rgb[1] - start.rgb[1]) * factor);
      const b = Math.round(start.rgb[2] + (end.rgb[2] - start.rgb[2]) * factor);

      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  //fallback
  return "rgb(128, 128, 128)";
}
