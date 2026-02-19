import { useState } from "react";
import { BarChart3, List, AlertCircle, Info, ChevronRight } from "lucide-react";
import ScoreCard from "./ScoreCard";
import { TYPE_HEX, TYPE_HEX_DARK } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeContext";

export default function InsightsPanel({
  results,
  checks,
  selectedFinding,
  onSelectFinding,
  isAnalyzing,
  isMobile = false,
}) {
  const { theme } = useTheme();
  const hexMap = theme === 'dark' ? TYPE_HEX_DARK : TYPE_HEX;
  const [activeTab, setActiveTab] = useState("summary");
  const [expandedFindingId, setExpandedFindingId] = useState(null);

  const tabs = [
    { key: "summary", label: "Summary", icon: BarChart3 },
    { key: "findings", label: "Findings", icon: List },
  ];

  const getSeverityBadge = (severity) => {
    const mutedHex = hexMap.structure;
    const langHex = hexMap.language;
    const styles = {
      low: { backgroundColor: "rgba(var(--type-structure) / 0.08)", color: "var(--color-text-muted)" },
      medium: { backgroundColor: `${mutedHex}18`, color: mutedHex },
      high: { backgroundColor: `${langHex}18`, color: langHex },
    };
    return styles[severity] || styles.low;
  };

  const getTypeBadgeStyle = (type) => {
    const hex = hexMap[type] || hexMap.structure;
    return {
      backgroundColor: `${hex}15`,
      color: hex,
    };
  };

  const renderEmptyState = () => (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
      <BarChart3 className="w-8 h-8 text-text-faint mb-4" />
      <h3 className="text-lg font-semibold text-text-primary mb-2" style={{ fontFamily: "var(--font-serif)" }}>No Analysis Yet</h3>
      <p className="text-text-muted text-sm max-w-xs">
        Upload a document and click Analyze to see insights
      </p>
    </div>
  );

  const renderLoading = () => (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
      <div className="w-8 h-8 border-2 border-rule border-t-accent rounded-full animate-spin mb-4" />
      <h3 className="text-lg font-semibold text-text-primary mb-2" style={{ fontFamily: "var(--font-serif)" }}>
        Deconstructing Argument
      </h3>
      <p className="text-text-muted text-sm">Exposing persuasive tactics...</p>
    </div>
  );

  const renderSummary = () => (
    <div className={`p-5 ${isMobile ? "grid grid-cols-2 gap-3" : "space-y-4"}`}>
      <ScoreCard
        label="Soundness"
        score={results?.scores?.structure ?? 0}
        type="structure"
        description="Formal logic quality: valid reasoning, no contradictions"
        compact={isMobile}
      />
      <ScoreCard
        label="Relevance"
        score={results?.scores?.relevance ?? 0}
        type="relevance"
        description="Premise-conclusion connection: stays on topic"
        compact={isMobile}
      />
      <ScoreCard
        label="Evidence"
        score={results?.scores?.evidence ?? 0}
        type="evidence"
        description="Quality and sufficiency of supporting evidence"
        compact={isMobile}
      />
      <ScoreCard
        label="Framing"
        score={results?.scores?.framing ?? 0}
        type="framing"
        description="Fair representation without distortion"
        compact={isMobile}
      />
      <ScoreCard
        label="Language"
        score={results?.scores?.language ?? 0}
        type="language"
        description="Neutral word choice without manipulation"
        compact={isMobile}
      />
      <ScoreCard
        label="Verifiability"
        score={results?.scores?.factcheck ?? 0}
        type="factcheck"
        description="Ability to back claims with evidence"
        compact={isMobile}
      />

      {results?.summary && (
        <div className={`mt-6 p-4 bg-white border border-rule ${isMobile ? "col-span-2" : ""}`}>
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-text-muted" />
            <div>
              <h4 className="text-sm font-medium text-text-primary mb-1">
                Executive Summary
              </h4>
              <p className="text-sm text-text-muted leading-relaxed">
                {results.summary}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderFindings = () => (
    <div className="p-5">
      {!results?.findings || results.findings.length === 0 ? (
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-text-faint mx-auto mb-3" />
          <p className="text-text-muted">No linguistic tricks detected</p>
        </div>
      ) : (
        <div className="space-y-3">
          {results.findings.map((finding) => {
            const isSelected = selectedFinding?.id === finding.id;
            const typeColor = hexMap[finding.type] || hexMap.structure;

            return (
              <div
                key={finding.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectFinding(finding)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ")
                    onSelectFinding(finding);
                }}
                className={`
                  w-full text-left p-4 border transition-all duration-200 cursor-pointer
                  ${
                    isSelected
                      ? "bg-white"
                      : "bg-cream border-rule-light hover:border-rule hover:bg-white"
                  }
                `}
                style={
                  isSelected
                    ? { borderColor: typeColor }
                    : undefined
                }
              >
                <div className="finding-header flex items-start justify-between gap-3 mb-2">
                  <span className="finding-title font-medium text-text-primary">
                    {finding.label}
                  </span>
                  <div className="finding-badges flex items-center gap-2">
                    <span
                      className="px-2 py-0.5 text-xs font-medium"
                      style={getTypeBadgeStyle(finding.type)}
                    >
                      {finding.type}
                    </span>
                    <span
                      className="px-2 py-0.5 text-xs font-medium"
                      style={getSeverityBadge(finding.severity)}
                    >
                      {finding.severity}
                    </span>
                  </div>
                </div>

                <p
                  className={`text-sm text-text-muted mb-3 ${
                    expandedFindingId === finding.id ? "" : "line-clamp-2"
                  }`}
                >
                  {finding.explanation}
                </p>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedFindingId((prev) =>
                      prev === finding.id ? null : finding.id
                    );
                  }}
                  className="flex items-center text-sm text-accent hover:text-accent-hover"
                >
                  <span>
                    {expandedFindingId === finding.id ? "Show less" : "Show more"}
                  </span>
                  <ChevronRight
                    className={`w-4 h-4 transition-transform ${
                      expandedFindingId === finding.id ? "rotate-90" : ""
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  if (isAnalyzing) return renderLoading();
  if (!results) return renderEmptyState();

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Tabs Header */}
      <div className="insights-tabs border-b border-rule px-4 py-3 flex gap-2 flex-shrink-0 bg-cream-dark">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.key;

          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`insights-tab-button flex flex-1 items-center justify-center gap-2 px-3 py-2 text-sm transition-none border ${
                active
                  ? "text-text-primary bg-white border-rule"
                  : "text-text-muted hover:text-text-body border-transparent"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {isMobile ? (
        <div className="flex-1 bg-cream-dark">
          <div className="insights-content overflow-y-auto custom-scrollbar">
            {activeTab === "summary" ? renderSummary() : renderFindings()}
          </div>
        </div>
      ) : (
        <div className="flex-1 relative bg-cream-dark">
          <div
            className={`insights-content absolute inset-0 overflow-y-auto custom-scrollbar p-5 space-y-4 ${
              activeTab === "summary"
                ? "opacity-100 z-10"
                : "opacity-0 z-0 pointer-events-none"
            }`}
            style={{ transition: "none" }}
          >
            {renderSummary()}
          </div>

          <div
            className={`insights-content absolute inset-0 overflow-y-auto custom-scrollbar p-5 ${
              activeTab === "findings"
                ? "opacity-100 z-10"
                : "opacity-0 z-0 pointer-events-none"
            }`}
            style={{ transition: "none" }}
          >
            {renderFindings()}
          </div>
        </div>
      )}
    </div>
  );
}
