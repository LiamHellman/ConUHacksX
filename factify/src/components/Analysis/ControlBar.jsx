import { ArrowRight, Brain, Scale, AlertOctagon } from "lucide-react";

// Paper palette category colors
const CATEGORY_COLORS = {
  bias: "#c44030",
  fallacy: "#b8860b",
  tactic: "#2e7d6e",
};

export default function ControlBar({
  checks,
  onToggleCheck,
  onAnalyze,
  isAnalyzing,
  hasContent,
  isMobile = false,
}) {
  const toggleItems = [
    {
      key: "bias",
      icon: <Brain size={16} />,
      label: "Bias Detection",
      color: CATEGORY_COLORS.bias,
      isActive: checks.bias,
    },
    {
      key: "fallacies",
      icon: <Scale size={16} />,
      label: "Logical Fallacies",
      color: CATEGORY_COLORS.fallacy,
      isActive: checks.fallacies,
    },
    {
      key: "tactic",
      icon: <AlertOctagon size={16} />,
      label: "Tactics",
      color: CATEGORY_COLORS.tactic,
      isActive: checks.tactic,
    },
  ];

  const anyOn = Object.values(checks).some(Boolean);
  const enabled = hasContent && !isAnalyzing && anyOn;

  return (
    <div className="control-bar h-14 px-6 bg-cream border-b border-rule flex items-center justify-between overflow-visible">
      {/* Toggle Pills */}
      <div className="flex items-center gap-2">
        {toggleItems.map((item) => (
          <button
            key={item.key}
            onClick={() => onToggleCheck(item.key)}
            className={`
              flex items-center gap-2 px-4 py-2 text-sm font-medium border transition-colors duration-150
              ${item.isActive
                ? "bg-white border-rule text-text-primary"
                : "bg-transparent border-transparent text-text-muted hover:text-text-body hover:border-rule-light"
              }
            `}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Analyze Button */}
      <button
        onClick={onAnalyze}
        disabled={!enabled}
        className={`
          analyze-button flex items-center gap-2 px-5 py-2 font-medium text-sm
          transition-colors duration-200
          ${enabled
            ? "text-text-primary hover:text-accent"
            : "text-text-faint cursor-not-allowed"
          }
        `}
      >
        {isAnalyzing ? (
          <>
            <div className="w-4 h-4 border-2 border-text-faint/30 border-t-accent rounded-full animate-spin" />
            <span>Analyzing...</span>
          </>
        ) : (
          <>
            <ArrowRight className="w-4 h-4" />
            <span>Analyze</span>
          </>
        )}
      </button>
    </div>
  );
}