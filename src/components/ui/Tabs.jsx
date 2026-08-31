import "./Tabs.css";

export function Tabs({ tabs, activeKey, onChange }) {
  return (
    <div className="tabs-bar">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.key}
            className={`tab-button ${activeKey === tab.key ? "active" : ""}`}
            onClick={() => onChange(tab.key)}
          >
            {Icon && <Icon size={13} />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
