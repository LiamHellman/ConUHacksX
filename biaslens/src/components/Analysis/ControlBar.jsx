import { Zap, Scale, AlertOctagon, Brain } from "lucide-react";
import Dock from "../Dock/Dock";

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
  const dockItems = [
    {
      icon: <Brain size={22} />,
      label: "Bias Detection",
      onClick: () => onToggleCheck("bias"),
      isActive: checks.bias,
      type: "bias",
      className: "dock-item--bias",
    },
    {
      icon: <Scale size={22} />,
      label: "Logical Fallacies",
      onClick: () => onToggleCheck("fallacies"),
      isActive: checks.fallacies,
      type: "fallacy",
      className: "dock-item--fallacy",
    },
    {
      icon: <AlertOctagon size={22} />,
      label: "Tactics",
      onClick: () => onToggleCheck("tactic"),
      isActive: checks.tactic,
      type: "tactic",
      className: "dock-item--tactic",
    },
  ];

  const anyOn = Object.values(checks).some(Boolean);
  const enabled = hasContent && !isAnalyzing && anyOn;

  const dockSizing = isMobile
    ? { panelHeight: 48, baseItemSize: 38, magnification: 46, distance: 120 }
    : { panelHeight: 56, baseItemSize: 44, magnification: 58, distance: 150 };

  return (
    <div className="control-bar h-16 px-6 bg-white border-b border-rule flex items-center justify-between overflow-visible">
      <Dock
        items={dockItems}
        panelHeight={dockSizing.panelHeight}
        baseItemSize={dockSizing.baseItemSize}
        magnification={dockSizing.magnification}
        distance={dockSizing.distance}
        className={isMobile ? "dock-panel--mobile" : ""}
      />

      <button
        onClick={onAnalyze}
        disabled={!enabled}
        className={`
          analyze-button flex items-center gap-2 px-6 py-2.5 font-semibold
          transition-colors duration-200
          ${enabled
            ? "bg-accent hover:bg-accent-hover text-white"
            : "bg-cream-darker text-text-faint cursor-not-allowed"
          }
        `}
      >
        {isAnalyzing ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>Analyzing...</span>
          </>
        ) : (
          <>
            <Zap className="w-5 h-5" />
            <span>Analyze</span>
          </>
        )}
      </button>
    </div>
  );
}