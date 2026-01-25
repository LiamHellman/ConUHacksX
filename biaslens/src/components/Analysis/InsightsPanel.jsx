import { useState } from "react";
import {
  BarChart3,
  List,
  RefreshCw,
  AlertCircle,
  Info,
  ChevronRight,
} from "lucide-react";
import ScoreCard from "./ScoreCard";

export default function InsightsPanel({
  results,
  checks,
  selectedFinding,
  onSelectFinding,
  isAnalyzing,
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

  const getTypeBadge = (type) => {
    const styles = {
      bias: "bg-pink-500/20 text-pink-400",
      fallacy: "bg-amber-500/20 text-amber-400",
      tactic: "bg-blue-500/20 text-blue-400",
    };
    return styles[type] || "bg-gray-500/20 text-gray-400";
  };

  const renderEmptyState = () => (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
      <div className="w-16 h-16 rounded-2xl bg-dark-700 flex items-center justify-center mb-4">
        <BarChart3 className="w-8 h-8 text-gray-500" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">No Analysis Yet</h3>
      <p className="text-gray-500 text-sm max-w-xs">
        Upload a document and click Deconstruct to see insights
      </p>
    </div>
  );

  const renderLoading = () => (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
      <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-4">
        <div className="w-8 h-8 border-3 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">
        Deconstructing Argument
      </h3>
      <p className="text-gray-500 text-sm">Exposing persuasive tactics...</p>
    </div>
  );

  const renderSummary = () => (
    <div className="p-5 space-y-4">
      <ScoreCard
        label="Neutrality"
        score={results?.scores?.bias ?? 0}
        color="pink"
        description="Measures emotional nudges and loaded language"
      />
      <ScoreCard
        label="Soundness"
        score={results?.scores?.fallacies ?? 0}
        color="amber"
        description="Identifies gaps in logical reasoning"
      />
      <ScoreCard
        label="Transparency"
        score={results?.scores?.tactic ?? 0}
        color="blue"
        description="Detects hidden persuasive techniques"
      />
      <ScoreCard
        label="Verifiability"
        score={results?.scores?.factcheck ?? 0}
        color="purple"
        description="Ability to back claims with evidence"
      />

      {results?.summary && (
        <div className="mt-6 p-4 bg-dark-700/50 rounded-xl border border-dark-600">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
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
          {results.findings.map((finding) => (
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
                  selectedFinding?.id === finding.id
                    ? "bg-dark-700 border-purple-500/50 ring-2 ring-purple-500/20"
                    : "bg-dark-800/50 border-dark-600 hover:border-dark-500 hover:bg-dark-700/50"
                }
              `}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <span className="font-medium text-white">{finding.label}</span>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeBadge(finding.type)}`}
                  >
                    {finding.type}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityBadge(finding.severity)}`}
                  >
                    {finding.severity}
                  </span>
                </div>
              </div>
              <p
                className={`text-sm text-gray-400 mb-3 ${expandedFindingId === finding.id ? "" : "line-clamp-2"}`}
              >
                {finding.explanation}
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedFindingId((prev) =>
                    prev === finding.id ? null : finding.id,
                  );
                }}
                className="flex items-center text-purple-400 text-sm hover:text-purple-300"
              >
                <span>
                  {expandedFindingId === finding.id ? "Show less" : "Show more"}
                </span>
                <ChevronRight
                  className={`w-4 h-4 transition-transform ${expandedFindingId === finding.id ? "rotate-90" : ""}`}
                />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (isAnalyzing) return renderLoading();
  if (!results) return renderEmptyState();

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Tabs Header */}
      <div className="border-b border-dark-700 px-4 py-3 flex gap-2 flex-shrink-0 bg-dark-900">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex flex-1 items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-none ${
                active
                  ? "bg-purple-500/10 text-white border border-purple-500/30"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* The Content Area */}
      <div className="flex-1 relative bg-dark-900">
        {/* Summary Tab */}
        <div
          className={`absolute inset-0 overflow-y-auto custom-scrollbar p-5 space-y-4 ${
            activeTab === "summary"
              ? "opacity-100 z-10"
              : "opacity-0 z-0 pointer-events-none"
          }`}
          style={{ transition: "none" }} // Forces an instant swap with no fading/flashing
        >
          {renderSummary()}
        </div>

        {/* Findings Tab */}
        <div
          className={`absolute inset-0 overflow-y-auto custom-scrollbar p-5 ${
            activeTab === "findings"
              ? "opacity-100 z-10"
              : "opacity-0 z-0 pointer-events-none"
          }`}
          style={{ transition: "none" }}
        >
          {renderFindings()}
        </div>
      </div>
    </div>
  );
}
