export function Badge({ def, magnitude }) {
  const Icon = def.icon;
  return (
    <span
      title={`${def.label} (${Math.round(magnitude * 100)}%)`}
      className="milestone-button"
      style={{
        color: `var(${def.color})`
      }}
    >
      <Icon size={12} strokeWidth={2.4} />
      {def.label}
    </span>
  );
}
