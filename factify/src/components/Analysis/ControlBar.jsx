import { ArrowRight, GitBranch, Compass, BarChart2, Frame, Type } from "lucide-react";

// 5-category palette
const CATEGORY_COLORS = {
  structure: "#b8860b",
  relevance: "#4a6fa5",
  evidence:  "#2e7d6e",
  framing:   "#7850a0",
  language:  "#c44030",
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
      key: "structure",
      icon: <GitBranch size={16} />,
      label: "Structure",
      color: CATEGORY_COLORS.structure,
      isActive: checks.structure,
    },
    {
      key: "relevance",
      icon: <Compass size={16} />,
      label: "Relevance",
      color: CATEGORY_COLORS.relevance,
      isActive: checks.relevance,
    },
    {
      key: "evidence",
      icon: <BarChart2 size={16} />,
      label: "Evidence",
      color: CATEGORY_COLORS.evidence,
      isActive: checks.evidence,
    },
    {
      key: "framing",
      icon: <Frame size={16} />,
      label: "Framing",
      color: CATEGORY_COLORS.framing,
      isActive: checks.framing,
    },
    {
      key: "language",
      icon: <Type size={16} />,
      label: "Language",
      color: CATEGORY_COLORS.language,
      isActive: checks.language,
    },
  ];

  const anyOn = Object.values(checks).some(Boolean);
  const enabled = hasContent && !isAnalyzing && anyOn;

	return (
	  <div
		className={`control-bar bg-cream border-b border-rule overflow-visible
		  ${isMobile
			? "px-4 py-2 flex flex-col gap-2"
			: "h-14 px-6 flex items-center justify-between"
		  }`}
	  >
		{/* Toggle Pills */}
		<div
		  className={
			isMobile
			  ? "grid grid-cols-5 gap-1 w-full"
			  : "flex items-center gap-1.5 flex-wrap"
		  }
		>
		  {toggleItems.map((item) => (
			<button
			  key={item.key}
			  onClick={() => onToggleCheck(item.key)}
			  className={`
				flex items-center gap-1.5 font-medium border transition-colors duration-150
				${isMobile ? "w-full justify-center px-2.5 py-1.5 text-xs" : "px-4 py-2 text-sm"}
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
			  {!isMobile && <span>{item.label}</span>}
			</button>
		  ))}
		</div>

		{/* Analyze Button */}
		<button
		  onClick={onAnalyze}
		  disabled={!enabled}
		  className={`
			analyze-button flex items-center gap-2 font-medium transition-colors duration-200 flex-shrink-0
			${isMobile ? "w-full justify-center px-3 py-1.5 text-xs" : "px-5 py-2 text-sm"}
			${enabled ? "text-text-primary hover:text-accent" : "text-text-faint cursor-not-allowed"}
		  `}
		>
        {isAnalyzing ? (
          <>
            <div className="w-4 h-4 border-2 border-text-faint/30 border-t-accent rounded-full animate-spin" />
            {!isMobile && <span>Analyzing...</span>}
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
