import { Zap, Scale, AlertOctagon, Brain } from "lucide-react";
import GlareHover from "../GlareHover/GlareHover";
import Dock from "../Dock/Dock";

// Theme helpers (OKLab-derived RGB injected as CSS vars by applyThemeVars())
const BRAND_RGB = "var(--brand, var(--type-factcheck, 168 85 247))";
const brandBg = (a) => `rgb(${BRAND_RGB} / ${a})`;
const brandFg = (a = 1) => `rgb(${BRAND_RGB} / ${a})`;

const typeRgbVar = (type) => `var(--type-${type}, 255 255 255)`;
const typeBg = (type, a) => `rgb(${typeRgbVar(type)} / ${a})`;
const typeFg = (type, a = 1) => `rgb(${typeRgbVar(type)} / ${a})`;

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
      // New: semantic type (preferred)
      type: "bias",
      // Keep className for backwards compatibility with existing Dock CSS
      className: "dock-item--bias",
      // New: theme-driven styling (requires Dock to forward `style` to the clickable element)
      style: (isActive) => ({
        backgroundColor: isActive ? typeBg("bias", 0.14) : "transparent",
        borderColor: typeBg("bias", isActive ? 0.45 : 0.18),
        color: typeFg("bias", isActive ? 1 : 0.85),
      }),
    },
    {
      icon: <Scale size={22} />,
      label: "Logical Fallacies",
      onClick: () => onToggleCheck("fallacies"),
      isActive: checks.fallacies,
      type: "fallacy",
      className: "dock-item--fallacy",
      style: (isActive) => ({
        backgroundColor: isActive ? typeBg("fallacy", 0.14) : "transparent",
        borderColor: typeBg("fallacy", isActive ? 0.45 : 0.18),
        color: typeFg("fallacy", isActive ? 1 : 0.85),
      }),
    },
    {
      icon: <AlertOctagon size={22} />,
      label: "Tactics",
      onClick: () => onToggleCheck("tactic"),
      isActive: checks.tactic,
      type: "tactic",
      className: "dock-item--tactic",
      style: (isActive) => ({
        backgroundColor: isActive ? typeBg("tactic", 0.14) : "transparent",
        borderColor: typeBg("tactic", isActive ? 0.45 : 0.18),
        color: typeFg("tactic", isActive ? 1 : 0.85),
      }),
    },
  ];

  const anyOn = Object.values(checks).some(Boolean);
  const enabled = hasContent && !isAnalyzing && anyOn;

  const dockSizing = isMobile
    ? { panelHeight: 48, baseItemSize: 38, magnification: 46, distance: 120 }
    : { panelHeight: 56, baseItemSize: 44, magnification: 58, distance: 150 };

  return (
    <div className="control-bar h-20 px-6 bg-dark-900 border-b border-dark-700 flex items-center justify-between overflow-visible">
      <Dock
        // If Dock forwards item props, it can use `item.style(item.isActive)`
        items={dockItems}
        panelHeight={dockSizing.panelHeight}
        baseItemSize={dockSizing.baseItemSize}
        magnification={dockSizing.magnification}
        distance={dockSizing.distance}
        className={isMobile ? "dock-panel--mobile" : ""}
      />

      <GlareHover
        width="auto"
        height="auto"
        background="transparent"
        borderRadius="8px"
        borderColor="transparent"
        glareColor="#ffffff"
        glareOpacity={0.3}
        glareAngle={-30}
        glareSize={300}
        transitionDuration={800}
        style={{ opacity: enabled ? 1 : 0.5 }}
      >
        <button
          onClick={onAnalyze}
          disabled={!enabled}
          className={`
            analyze-button flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold
            transition-all duration-300
            ${enabled ? "text-white shadow-lg" : "bg-dark-700 text-gray-500 cursor-not-allowed"}
          `}
          style={
            enabled
              ? {
                  backgroundColor: brandBg(1),
                  boxShadow: `0 12px 28px -18px ${brandBg(0.95)}, 0 0 0 1px ${brandBg(0.35)}`,
                }
              : undefined
          }
          onMouseEnter={(e) => {
            if (!enabled) return;
            e.currentTarget.style.backgroundColor = brandBg(0.92);
            e.currentTarget.style.boxShadow = `0 14px 32px -18px ${brandBg(
              0.9
            )}, 0 0 0 1px ${brandBg(0.45)}`;
          }}
          onMouseLeave={(e) => {
            if (!enabled) return;
            e.currentTarget.style.backgroundColor = brandBg(1);
            e.currentTarget.style.boxShadow = `0 12px 28px -18px ${brandBg(
              0.95
            )}, 0 0 0 1px ${brandBg(0.35)}`;
          }}
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
      </GlareHover>
    </div>
  );
}