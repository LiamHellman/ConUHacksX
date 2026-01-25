import { useState, useEffect, useMemo } from "react";
import UploadPanel from "./UploadPanel";
import ControlBar from "./ControlBar";
import DocumentViewer from "./DocumentViewer";
import InsightsPanel from "./InsightsPanel";
import AnimatedContent from "../AnimatedContent/AnimatedContent";
import { analyzeText } from "../../api/analyze";
import { FileText, Youtube, Music, Video as VideoIcon } from "lucide-react";

/**
 * Map UI toggle keys -> finding.type values coming from llm.js
 * (Your ControlBar uses `fallacies`, but llm.js outputs `type: "fallacy"`.)
 */
const CHECK_TO_TYPES = {
  bias: new Set(["bias"]),
  fallacies: new Set(["fallacy"]),
  tactic: new Set(["tactic"]),
  // factcheck is a score-only toggle in your current schema; no highlights unless you add a `factcheck` finding type
  factcheck: new Set(["factcheck", "claim"]),
};

function severityRank(sev) {
  switch (sev) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
    default:
      return 1;
  }
}

/**
 * Given overlapping findings, produce a NON-overlapping list suitable for DocumentViewer.
 * We do this by:
 *  - Partitioning text into boundary intervals (all starts/ends)
 *  - For each interval, picking the "best" covering finding by:
 *      severity DESC, confidence DESC, length DESC
 *  - Merging adjacent intervals that select the same finding
 *
 * This ensures:
 *  - Only one highlight per character (DocumentViewer needs this)
 *  - Disabling a category can reveal underlying segments from other categories
 */
function resolveOverlapsIntoSegments(text, findings) {
  if (!text || !Array.isArray(findings) || findings.length === 0) return [];

  const n = text.length;

  // Collect boundaries
  const boundaries = new Set([0, n]);
  for (const f of findings) {
    if (!f) continue;
    const s = Math.max(0, Math.min(n, f.start));
    const e = Math.max(0, Math.min(n, f.end));
    if (e > s) {
      boundaries.add(s);
      boundaries.add(e);
    }
  }

  const pts = Array.from(boundaries).sort((a, b) => a - b);

  // Helper: best finding among candidates
  const pickBest = (cands) => {
    let best = null;
    let bestScore = -Infinity;
    for (const f of cands) {
      const sRank = severityRank(f.severity);
      const conf = typeof f.confidence === "number" ? f.confidence : 0;
      const len = Math.max(0, (f.end ?? 0) - (f.start ?? 0));
      // weight severity heavily, then confidence, then length
      const score = sRank * 1000 + conf * 100 + len * 0.001;
      if (score > bestScore) {
        bestScore = score;
        best = f;
      }
    }
    return best;
  };

  // Build chosen segments
  const segments = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (b <= a) continue;

    // All findings that fully cover [a, b)
    const cands = findings.filter((f) => f.start <= a && f.end >= b);
    if (cands.length === 0) continue;

    const best = pickBest(cands);
    if (!best) continue;

    segments.push({
      // Keep the same ID so selection from InsightsPanel still matches
      ...best,
      start: a,
      end: b,
      quote: text.slice(a, b),
    });
  }

  if (segments.length === 0) return [];

  // Merge adjacent segments with same id + type + severity (so you don’t create tons of tiny spans)
  const merged = [];
  let cur = segments[0];

  for (let i = 1; i < segments.length; i++) {
    const nxt = segments[i];
    const same =
      nxt.id === cur.id &&
      nxt.type === cur.type &&
      nxt.severity === cur.severity &&
      nxt.start === cur.end;

    if (same) {
      cur = {
        ...cur,
        end: nxt.end,
        quote: text.slice(cur.start, nxt.end),
      };
    } else {
      merged.push(cur);
      cur = nxt;
    }
  }
  merged.push(cur);

  // Ensure sorted + non-overlapping
  merged.sort((x, y) => x.start - y.start);

  return merged;
}

export default function AnalysisPage() {
  const [history, setHistory] = useState([]);
  const [activeId, setActiveId] = useState(null);

  const [uploadedFile, setUploadedFile] = useState(null);
  const [pastedText, setPastedText] = useState("");
  const [documentContent, setDocumentContent] = useState("");
  const [checks, setChecks] = useState({
    bias: true,
    fallacies: true,
    tactic: true,
    factcheck: true,
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [selectedFinding, setSelectedFinding] = useState(null);

  // --- PERSISTENCE: Load history ---
  useEffect(() => {
    const saved = localStorage.getItem("biaslens_history");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setHistory(parsed);
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // --- PERSISTENCE: Save history ---
  useEffect(() => {
    if (history.length === 0) localStorage.removeItem("biaslens_history");
    else localStorage.setItem("biaslens_history", JSON.stringify(history));
  }, [history]);

  const addToHistory = (title, text, type) => {
    const newEntry = {
      id: Date.now(),
      title: title || "Untitled Analysis",
      content: text,
      type: type,
      results: null,
    };
    setHistory((prev) => [newEntry, ...prev]);
    setActiveId(newEntry.id);
    setDocumentContent(text);
    setResults(null);
    setSelectedFinding(null);
  };

  const handleResume = (item) => {
    setActiveId(item.id);
    setDocumentContent(item.content);
    setResults(item.results);
    setSelectedFinding(null);
  };

  useEffect(() => {
    if (uploadedFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        addToHistory(uploadedFile.name, e.target.result, "text");
        setUploadedFile(null);
      };
      reader.readAsText(uploadedFile);
    }
  }, [uploadedFile]);

  useEffect(() => {
    if (pastedText) {
      addToHistory("Pasted Text", pastedText, "text");
      setPastedText("");
    }
  }, [pastedText]);

  const handleClearHistory = () => {
    setHistory([]);
    setActiveId(null);
    setDocumentContent("");
    setResults(null);
    setSelectedFinding(null);
    localStorage.removeItem("biaslens_history");
  };

  const handleAnalyze = async () => {
    if (!documentContent) return;
    setIsAnalyzing(true);
    try {
      const data = await analyzeText(documentContent, {
        maxFindings: 10,
        temperature: 0.2,
      });
      setResults(data);

      setHistory((prev) =>
        prev.map((item) =>
          item.id === activeId ? { ...item, results: data } : item
        )
      );
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * 1) Filter findings by enabled categories (so toggles remove INSIGHTS and eligible highlights)
   * 2) Resolve overlaps into non-overlapping segments for DocumentViewer (so it renders correctly)
   */
  const enabledFindings = useMemo(() => {
    const all = results?.findings ?? [];
    if (!Array.isArray(all) || all.length === 0) return [];

    // Which types are enabled right now?
    const enabledTypes = new Set();
    for (const [checkKey, typeSet] of Object.entries(CHECK_TO_TYPES)) {
      if (checks[checkKey]) {
        for (const t of typeSet) enabledTypes.add(t);
      }
    }

    // If you want factcheck toggle to ONLY affect the score and NOT any highlights,
    // remove "factcheck"/"claim" from CHECK_TO_TYPES.factcheck above.
    return all.filter((f) => enabledTypes.has(f.type));
  }, [results, checks]);

  const docFindings = useMemo(() => {
    return resolveOverlapsIntoSegments(documentContent, enabledFindings);
  }, [documentContent, enabledFindings]);

  // If selected finding becomes disabled, clear selection
  useEffect(() => {
    if (!selectedFinding) return;
    const stillVisible = enabledFindings.some((f) => f.id === selectedFinding.id);
    if (!stillVisible) setSelectedFinding(null);
  }, [enabledFindings, selectedFinding]);

  // Wrap results for InsightsPanel so it shows only enabled findings
  const resultsForPanel = useMemo(() => {
    if (!results) return results;
    return { ...results, findings: enabledFindings };
  }, [results, enabledFindings]);

  return (
    <AnimatedContent className="h-[calc(100vh-64px)] flex flex-col bg-dark-950">
      <ControlBar
        checks={checks}
        onToggleCheck={(key) =>
          setChecks((prev) => ({ ...prev, [key]: !prev[key] }))
        }
        onAnalyze={handleAnalyze}
        isAnalyzing={isAnalyzing}
        hasContent={!!documentContent}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* --- LEFT PANEL: Upload + History List --- */}
        <div className="w-80 border-r border-dark-700 bg-dark-900 flex flex-col flex-shrink-0 h-full">
          {/* Top fixed part: Upload Inputs */}
          <div className="flex-shrink-0 border-b border-dark-700/50">
            <UploadPanel
              onFileUpload={setUploadedFile}
              onTextPaste={setPastedText}
              onMediaTranscribe={(file, text) =>
                addToHistory(
                  file.name,
                  text,
                  file.type === "video/youtube" ? "youtube" : "video"
                )
              }
              uploadedFile={uploadedFile}
              pastedText={pastedText}
            />
          </div>

          {/* Bottom scrollable part: History List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="px-5 py-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                  Recent Sessions
                </h3>

                {history.length > 0 && (
                  <button
                    onClick={handleClearHistory}
                    className="text-[10px] text-gray-500 hover:text-gray-300 uppercase tracking-widest"
                    title="Clear history"
                  >
                    Clear
                  </button>
                )}
              </div>

              {history.length === 0 ? (
                <div className="text-center py-8 px-4 border border-dashed border-dark-700 rounded-xl">
                  <p className="text-xs text-gray-600 italic">
                    No recent analyses yet
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((item) => {
                    let Icon = FileText;
                    if (item.type === "video") Icon = VideoIcon;
                    if (item.type === "youtube") Icon = Youtube;
                    if (item.type === "audio") Icon = Music;

                    return (
                      <button
                        key={item.id}
                        onClick={() => handleResume(item)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left group ${
                          activeId === item.id
                            ? "bg-purple-500/10 border-purple-500/50 text-white"
                            : "bg-dark-800/40 border-dark-700 text-gray-400 hover:border-dark-600 hover:bg-dark-800"
                        }`}
                      >
                        <Icon
                          size={16}
                          className={
                            activeId === item.id
                              ? "text-purple-400"
                              : "text-gray-500 group-hover:text-gray-400"
                          }
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm truncate font-medium">
                            {item.title}
                          </span>
                          {item.results && (
                            <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-tighter">
                              Analyzed
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* --- CENTER PANEL: Document Content --- */}
        <div className="flex-1 bg-dark-800 min-w-0">
          <DocumentViewer
            content={documentContent}
            findings={docFindings}
            selectedFinding={selectedFinding}
            onSelectFinding={setSelectedFinding}
          />
        </div>

        {/* --- RIGHT PANEL: Analysis Insights --- */}
        <div className="w-96 border-l border-dark-700 bg-dark-900 flex-shrink-0">
          <InsightsPanel
            results={resultsForPanel}
            checks={checks}
            selectedFinding={selectedFinding}
            onSelectFinding={setSelectedFinding}
            isAnalyzing={isAnalyzing}
          />
        </div>
      </div>
    </AnimatedContent>
  );
}
