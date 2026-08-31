export function frameToTime(frame) {
  const totalSeconds = Math.floor(frame / 30);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export const AWARD_LABELS = {
  resourceDestroyer: "Resource Destroyer",
  unitKiller: "Unit Killer",
  defenseDestroyer: "Defense Destroyer",
  damageEfficiency: "Damage Efficiency",
  traitor: "Traitor",
  goldenCow: "Golden Cow",
};

const UNIT_PREFIXES = {
  cor: "Cortex",
  arm: "Armada",
  leg: "Legion",
};

export function formatUnitName(definitionName) {
  for (const [prefix, faction] of Object.entries(UNIT_PREFIXES)) {
    if (definitionName.startsWith(prefix)) {
      return `${faction} ${definitionName.slice(prefix.length)}`;
    }
  }
  return definitionName;
}
