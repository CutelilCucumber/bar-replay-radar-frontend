export function frameToTime(frame) {
  const totalSeconds = Math.floor(frame / 30);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

import unitData from "./units.json";

const FACTIONS = unitData.units.factions;
const UNIT_NAMES = unitData.units.names;

export function formatUnitName(definitionName) {
  if (UNIT_NAMES[definitionName]) {
    return UNIT_NAMES[definitionName];
  }
  for (const [prefix, faction] of Object.entries(FACTIONS)) {
    if (definitionName.startsWith(prefix)) {
      return `${faction} ${definitionName.slice(prefix.length)}`;
    }
  }
  return definitionName;
}
