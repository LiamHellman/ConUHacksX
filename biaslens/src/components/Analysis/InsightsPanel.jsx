import { useState } from "react";
import { BarChart3, List, AlertCircle, Info, ChevronRight } from "lucide-react";
import ScoreCard from "./ScoreCard";

// Theme helpers (OKLab-derived RGB injected as CSS vars by applyThemeVars())
const BRAND_RGB = "var(--brand, var(--type-factcheck, 168 85 247))";
const brandBg = (a) => `rgb(${BRAND_RGB} / ${a})`;
const brandFg = (a = 1) => `rgb(${BRAND_RGB} / ${a})`;

const typeRgbVar = (type) => `var(--type-${type}, 255 255 255)`;
const typeBg = (type, a) => `rgb(${typeRgbVar(type)} / ${a})`;
const typeFg = (type, a = 1) => `rgb(${typeRgbVar(type)} / ${a})`;

export default function InsightsPanel({
  results,
  checks,
  selectedFinding,
  onSelectFinding,
  isAnalyzing,
  isMobile = false,
}) {
  const [activeTab, setActiveTab] = useState("summary");
  const [expandedFindingId, setExpandedFindingId] = useState(null);

  const tabs = [
    { key: "summary", label: "Summary", icon: BarChart3 },
    { key: "findings", label: "Findings", icon: List },
  ];

  const getSeverityBadge = (severity) => {
    const styles = {
      low: "bg-gray-500/20 text-gray-400",
      medium: "bg-amber-500/20 text-amber-400",
      high: "bg-red-500/20 text-red-400",
    };
    return styles[severity] || styles.low;
  };

  // Theme-driven type badge style (no Tailwind palette dependency)
  const getTypeBadgeStyle = (type) => {
    // Your finding types are: bias | fallacy | tactic (and you may add factcheck elsewhere)
    const t = type || "bias";
    return {
      backgroundColor: typeBg(t, 0.16),
      color: typeFg(t, 1),
      border: `1px solid ${typeBg(t, 0.22)}`,
    };
  };

  const renderEmptyState = () => (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
      <div className="w-16 h-16 rounded-2xl bg-dark-700 flex items-center justify-center mb-4">
        <BarChart3 className="w-8 h-8 text-gray-500" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">No Analysis Yet</h3>
      <p className="text-gray-500 text-sm max-w-xs">
        Upload a document and click Analyze to see insights
      </p>
    </div>
  );

  const renderLoading = () => (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ backgroundColor: brandBg(0.10) }}
      >
        <div
          className="w-8 h-8 border-3 rounded-full animate-spin"
          style={{
            borderColor: brandBg(0.30),
            borderTopColor: brandBg(1),
          }}
        />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">
        Deconstructing Argument
      </h3>
      <p className="text-gray-500 text-sm">Exposing persuasive tactics...</p>
    </div>
  );

  const renderSummary = () => (
    <div className="p-5 space-y-4">
      {/* NOTE: requires ScoreCard update to accept `type` instead of `color` */}
      <ScoreCard
        label="Neutrality"
        score={results?.scores?.bias ?? 0}
        type="bias"
        description="Measures emotional nudges and loaded language"
      />
      <ScoreCard
        label="Soundness"
        score={results?.scores?.fallacies ?? 0}
        type="fallacy"
        description="Identifies gaps in logical reasoning"
      />
      <ScoreCard
        label="Transparency"
        score={results?.scores?.tactic ?? 0}
        type="tactic"
        description="Detects hidden persuasive techniques"
      />
      <ScoreCard
        label="Verifiability"
        score={results?.scores?.factcheck ?? 0}
        type="factcheck"
        description="Ability to back claims with evidence"
      />

      {results?.summary && (
        <div className="mt-6 p-4 bg-dark-700/50 rounded-xl border border-dark-600">
          <div className="flex items-start gap-3">
            <Info
              className="w-5 h-5 flex-shrink-0 mt-0.5"
              style={{ color: brandFg(0.95) }}
            />
            <div>
              <h4 className="text-sm font-medium text-white mb-1">
                Executive Summary
              </h4>
              <p className="text-sm text-gray-400 leading-relaxed">
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
          <AlertCircle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500">No linguistic tricks detected</p>
        </div>
      ) : (
        <div className="space-y-3">
          {results.findings.map((finding) => {
            const isSelected = selectedFinding?.id === finding.id;

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
                  w-full text-left p-4 rounded-xl border transition-all duration-200 cursor-pointer
                  ${
                    isSelected
                      ? "bg-dark-700"
                      : "bg-dark-800/50 border-dark-600 hover:border-dark-500 hover:bg-dark-700/50"
                  }
                `}
                style={
                  isSelected
                    ? {
                        borderColor: brandBg(0.50),
                        boxShadow: `0 0 0 2px ${brandBg(0.18)}`,
                      }
                    : undefined
                }
              >
                <div className="finding-header flex items-start justify-between gap-3 mb-2">
                  <span className="finding-title font-medium text-white">
                    {finding.label}
                  </span>
                  <div className="finding-badges flex items-center gap-2">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={getTypeBadgeStyle(finding.type)}
                    >
                      {finding.type}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityBadge(
                        finding.severity
                      )}`}
                    >
                      {finding.severity}
                    </span>
                  </div>
                </div>

                <p
                  className={`text-sm text-gray-400 mb-3 ${
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
                  className="flex items-center text-sm"
                  style={{ color: brandFg(0.95) }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = brandFg(1);
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = brandFg(0.95);
                  }}
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
      <div className="insights-tabs border-b border-dark-700 px-4 py-3 flex gap-2 flex-shrink-0 bg-dark-900">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.key;

          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`insights-tab-button flex flex-1 items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-none border ${
                active ? "text-white" : "text-gray-400 hover:text-gray-200 border-transparent"
              }`}
              style={
                active
                  ? {
                      backgroundColor: brandBg(0.10),
                      borderColor: brandBg(0.30),
                    }
                  : undefined
              }
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* The Content Area */}
      {isMobile ? (
        <div className="flex-1 bg-dark-900">
          <div className="insights-content overflow-y-auto custom-scrollbar p-5">
            {activeTab === "summary" ? renderSummary() : renderFindings()}
          </div>
        </div>
      ) : (
        <div className="flex-1 relative bg-dark-900">
          {/* Summary Tab */}
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

          {/* Findings Tab */}
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
