export function fmtClock(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

 export function frameToClock(frame) {
  return fmtClock((frame / FRAME_RATE) * 1000);
}