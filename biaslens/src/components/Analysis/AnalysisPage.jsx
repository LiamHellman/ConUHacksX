import { useState, useEffect, useMemo, useRef } from "react";
import { applyThemeVars } from "../../theme/colors";
import UploadPanel from "./UploadPanel";
import ControlBar from "./ControlBar";
import DocumentViewer from "./DocumentViewer";
import InsightsPanel from "./InsightsPanel";
import AnimatedContent from "../AnimatedContent/AnimatedContent";
import ResizableSections from "./ResizableSections";
import { analyzeText } from "../../api/analyze";
import { FileText, Youtube, Music, Video as VideoIcon } from "lucide-react";

/**
 * Map UI toggle keys -> finding.type values coming from llm.js
 * (ControlBar uses `fallacies`, but llm.js outputs `type: "fallacy"`.)
 */
const CHECK_TO_TYPES = {
  bias: new Set(["bias"]),
  fallacies: new Set(["fallacy"]),
  tactic: new Set(["tactic"]),
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
 *  - Merging adjacent intervals that select the same finding-set
 */
function buildHighlightSpans(text, findings) {
  if (!text || !Array.isArray(findings) || findings.length === 0) return [];

  const n = text.length;

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

  const pickBest = (cands) => {
    let best = null;
    let bestScore = -Infinity;

    for (const f of cands) {
      const sRank = severityRank(f.severity);
      const conf = typeof f.confidence === "number" ? f.confidence : 0;
      const len = Math.max(0, (f.end ?? 0) - (f.start ?? 0));
      const score = sRank * 1000 + conf * 100 + len * 0.001;
      if (score > bestScore) {
        bestScore = score;
        best = f;
      }
    }
    return best;
  };

  // Build raw spans
  const spans = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (b <= a) continue;

    const active = findings.filter((f) => f.start <= a && f.end >= b);
    if (active.length === 0) continue;

    // Stable key so we can merge adjacent spans with same active set
    const key = active
      .map((f) => f.id)
      .sort()
      .join("|");

    spans.push({
      start: a,
      end: b,
      quote: text.slice(a, b),
      findings: active,
      primary: pickBest(active),
      _key: key,
    });
  }

  if (spans.length === 0) return [];

  // Merge adjacent spans if the active finding-set is identical
  const merged = [];
  let cur = spans[0];

  for (let i = 1; i < spans.length; i++) {
    const nxt = spans[i];
    if (nxt.start === cur.end && nxt._key === cur._key) {
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

  return merged.map(({ _key, ...rest }) => rest);
}

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function makeDoc({ title, content, type }) {
  return {
    id: uid(),
    title: title || "Untitled",
    content: content || "",
    type: type || "text",
    results: null, // (single-analysis per doc for now)
  };
}

/**
 * Back-compat normalization:
 * Old shape: { id, title, content, type, results }
 * New shape: { id, title, docs: [doc...], activeDocId }
 */
function normalizeSession(item) {
  if (!item) return null;
  if (item.docs && Array.isArray(item.docs)) {
    const docs = item.docs || [];
    return {
      ...item,
      activeDocId: item.activeDocId || docs[0]?.id || null,
    };
  }

  const doc = makeDoc({
    title: item.title || "Document",
    content: item.content || "",
    type: item.type || "text",
  });

  doc.results = item.results ?? null;

  return {
    id: item.id ?? Date.now(),
    seq: typeof item.seq === "number" ? item.seq : null, // retained for back-compat
    title: item.title || "Session",
    docs: [doc],
    activeDocId: doc.id,
  };
}

// Small helpers for theme-driven accents (OKLab-derived RGB via CSS vars)
const BRAND_RGB = "var(--brand, var(--type-factcheck, 168 85 247))"; // fallback to violet-ish if missing
const brandBg = (a) => `rgb(${BRAND_RGB} / ${a})`;
const brandFg = (a = 1) => `rgb(${BRAND_RGB} / ${a})`;

export default function AnalysisPage() {
  const [history, setHistory] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [activeDocId, setActiveDocId] = useState(null);

  // Multi-upload queue (text files)
  const [uploadedFiles, setUploadedFiles] = useState([]);

  const [pastedText, setPastedText] = useState("");

  const [checks, setChecks] = useState({
    bias: true,
    fallacies: true,
    tactic: true,
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState(null);

  // Initialize OKLab/OKLCH theme vars once
  useEffect(() => {
    applyThemeVars();
  }, []);

  // ---- persistence: load ----
  useEffect(() => {
    const saved = localStorage.getItem("biaslens_history");
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);
      const normalized = (parsed || []).map(normalizeSession).filter(Boolean);
      setHistory(normalized);

      const first = normalized[0] || null;
      if (first) {
        setActiveSessionId(first.id);
        setActiveDocId(first.activeDocId || first.docs?.[0]?.id || null);
      }
    } catch (e) {
      console.error("Failed to parse history", e);
    }
  }, []);

  // ---- persistence: save ----
  useEffect(() => {
    if (history.length === 0) localStorage.removeItem("biaslens_history");
    else localStorage.setItem("biaslens_history", JSON.stringify(history));
  }, [history]);

  const activeSession = useMemo(() => {
    if (!activeSessionId) return null;
    return history.find((h) => h.id === activeSessionId) || null;
  }, [history, activeSessionId]);

  const activeDoc = useMemo(() => {
    if (!activeSession) return null;
    const docs = activeSession.docs || [];
    const id = activeDocId || activeSession.activeDocId || docs[0]?.id || null;
    return docs.find((d) => d.id === id) || docs[0] || null;
  }, [activeSession, activeDocId]);

  const documentContent = activeDoc?.content || "";
  const results = activeDoc?.results || null;

  /**
   * Media batch tracking:
   * batchId -> { sessionId, count, firstTitle, upgraded }
   */
  const mediaBatchToSessionRef = useRef(new Map());

  function createSessionWithDocs({ title = "Session", docs = [] }) {
    const sessionId = Date.now();

    const session = {
      id: sessionId,
      title,
      docs,
      activeDocId: docs[0]?.id || null,
    };

    setHistory((prev) => [session, ...prev]);
    setActiveSessionId(sessionId);
    setActiveDocId(session.activeDocId);
    setSelectedFinding(null);

    return sessionId;
  }

  function renameSession(sessionId, newTitle) {
    setHistory((prev) =>
      prev.map((s) =>
        s.id === sessionId ? { ...normalizeSession(s), title: newTitle } : s
      )
    );
  }

  function addDocToSession(sessionId, doc) {
    setHistory((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId) return s;
        const next = normalizeSession(s);
        const nextDocs = [...(next.docs || []), doc];
        return {
          ...next,
          docs: nextDocs,
          activeDocId: next.activeDocId || doc.id,
        };
      })
    );

    setActiveSessionId(sessionId);
    setActiveDocId((cur) => cur || doc.id);
    setSelectedFinding(null);
  }

  // ---- handle multi-uploaded text files ----
  useEffect(() => {
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    const files = [...uploadedFiles];
    const firstName = files[0]?.name || "Session";
    const sessionTitle = files.length > 1 ? `${firstName} …` : firstName;

    const sessionId = createSessionWithDocs({ title: sessionTitle, docs: [] });

    (async () => {
      for (const file of files) {
        try {
          const text = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
          });

          const doc = makeDoc({
            title: file.name,
            content: String(text),
            type: "text",
          });

          addDocToSession(sessionId, doc);
        } catch (e) {
          console.error("Failed to read file:", file?.name, e);
        }
      }

      setUploadedFiles([]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadedFiles]);

  // ---- pasted text -> new doc ----
  useEffect(() => {
    if (!pastedText) return;

    const doc = makeDoc({ title: "Pasted Text", content: pastedText, type: "text" });
    createSessionWithDocs({ title: doc.title, docs: [doc] });

    setPastedText("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pastedText]);

  const handleResumeSession = (item) => {
    const session = normalizeSession(item);
    setActiveSessionId(session.id);
    setActiveDocId(session.activeDocId || session.docs?.[0]?.id || null);
    setSelectedFinding(null);
  };

  const handleSelectFinding = (finding) => {
    if (!finding) {
      setSelectedFinding(null);
      return;
    }

    setSelectedFinding((prev) => (prev?.id === finding.id ? null : finding));
  };

  const handleClearHistory = () => {
    setHistory([]);
    setActiveSessionId(null);
    setActiveDocId(null);
    setSelectedFinding(null);
    localStorage.removeItem("biaslens_history");
  };

  const handleAnalyze = async () => {
    if (!activeDoc?.content) return;

    setIsAnalyzing(true);
    try {
      const data = await analyzeText(activeDoc.content, {
        maxFindings: 10,
        temperature: 0.2,
      });

      setHistory((prev) =>
        prev.map((s) => {
          if (s.id !== activeSessionId) return s;
          const next = normalizeSession(s);
          return {
            ...next,
            docs: (next.docs || []).map((d) =>
              d.id === activeDoc.id ? { ...d, results: data } : d
            ),
          };
        })
      );
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * Filter findings by enabled toggles (affects Findings + highlighting only)
   */
  const enabledFindings = useMemo(() => {
    const all = results?.findings ?? [];
    if (!Array.isArray(all) || all.length === 0) return [];

    const enabledTypes = new Set();
    for (const [checkKey, typeSet] of Object.entries(CHECK_TO_TYPES)) {
      if (checks[checkKey]) {
        for (const t of typeSet) enabledTypes.add(t);
      }
    }

    return all.filter((f) => enabledTypes.has(f.type));
  }, [results, checks]);

  const docSpans = useMemo(() => {
    return buildHighlightSpans(documentContent, enabledFindings);
  }, [documentContent, enabledFindings]);

  // Clear selection if it becomes disabled/hidden
  useEffect(() => {
    if (!selectedFinding) return;
    const stillVisible = enabledFindings.some((f) => f.id === selectedFinding.id);
    if (!stillVisible) setSelectedFinding(null);
  }, [enabledFindings, selectedFinding]);

  // Panel sees only enabled findings; Summary remains unaffected in InsightsPanel
  const resultsForPanel = useMemo(() => {
    if (!results) return results;
    return { ...results, findings: enabledFindings };
  }, [results, enabledFindings]);

  return (
    <AnimatedContent className="h-[calc(100vh-64px)] flex flex-col bg-dark-950">
      <ControlBar
        checks={checks}
        onToggleCheck={(key) => setChecks((prev) => ({ ...prev, [key]: !prev[key] }))}
        onAnalyze={handleAnalyze}
        isAnalyzing={isAnalyzing}
        hasContent={!!documentContent}
      />

      <div className="flex-1 min-h-0 min-w-0">
        <ResizableSections
          left={
            <div className="h-full flex flex-col">
              <div className="flex-shrink-0 border-b border-dark-700/50">
                <UploadPanel
                  onFilesUpload={setUploadedFiles}
                  onFileUpload={(f) => setUploadedFiles(f ? [f] : [])}
                  onTextPaste={setPastedText}
                  onMediaTranscribe={(file, text, type, batchId) => {
                    let entry = mediaBatchToSessionRef.current.get(batchId);
                    if (!entry) {
                      const firstTitle = file.name;
                      const sessionId = createSessionWithDocs({ title: firstTitle, docs: [] });
                      entry = { sessionId, count: 0, firstTitle, upgraded: false };
                      mediaBatchToSessionRef.current.set(batchId, entry);
                    }
                    entry.count += 1;
                    if (entry.count === 2 && !entry.upgraded) {
                      renameSession(entry.sessionId, `${entry.firstTitle} …`);
                      entry.upgraded = true;
                    }
                    const doc = makeDoc({
                      title: file.name,
                      content: text,
                      type: type === "youtube" ? "youtube" : type,
                    });
                    addDocToSession(entry.sessionId, doc);
                  }}
                  uploadedFile={uploadedFiles?.[0] ?? null}
                  pastedText={pastedText}
                />
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="px-5 py-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: brandFg(1) }}
                      />
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
                      <p className="text-xs text-gray-600 italic">No recent analyses yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {history.map((item) => {
                        const session = normalizeSession(item);
                        const firstDocType = session.docs?.[0]?.type || "text";
                        let Icon = FileText;
                        if (firstDocType === "video") Icon = VideoIcon;
                        if (firstDocType === "youtube") Icon = Youtube;
                        if (firstDocType === "audio") Icon = Music;
                        const analyzedCount = (session.docs || []).filter((d) => d.results).length;
                        const isActive = activeSessionId === session.id;
                        const docCount = (session.docs || []).length;
                        const displayTitle =
                          docCount === 1 ? (session.docs?.[0]?.title || session.title) : session.title;
                        return (
                          <button
                            key={session.id}
                            onClick={() => handleResumeSession(session)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left group ${
                              isActive
                                ? "text-white"
                                : "bg-dark-800/40 border-dark-700 text-gray-400 hover:border-dark-600 hover:bg-dark-800"
                            }`}
                            style={
                              isActive
                                ? {
                                    backgroundColor: brandBg(0.10),
                                    borderColor: brandBg(0.50),
                                  }
                                : undefined
                            }
                          >
                            <Icon
                              size={16}
                              className={isActive ? "" : "text-gray-500 group-hover:text-gray-400"}
                              style={isActive ? { color: brandFg(0.95) } : undefined}
                            />
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm truncate font-medium">{displayTitle}</span>
                              {docCount > 1 && (
                                <span className="text-[10px] text-gray-500">
                                  {docCount} docs
                                  {analyzedCount > 0 ? ` • ${analyzedCount} analyzed` : ""}
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
          }
          center={
            <div className="h-full flex flex-col bg-dark-800 min-w-0">
              {activeSession?.docs?.length > 0 && (
                <div className="px-4 py-2 border-b border-dark-700 bg-dark-900/40 flex gap-2 overflow-x-auto custom-scrollbar">
                  {activeSession.docs.map((doc) => {
                    const isActive = activeDoc?.id === doc.id;
                    const hasResults = !!doc.results;
                    return (
                      <button
                        key={doc.id}
                        onClick={() => {
                          setActiveDocId(doc.id);
                          setHistory((prev) =>
                            prev.map((s) =>
                              s.id === activeSessionId
                                ? { ...normalizeSession(s), activeDocId: doc.id }
                                : s
                            )
                          );
                          setSelectedFinding(null);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm border whitespace-nowrap transition-all flex items-center gap-2 ${
                          isActive
                            ? "text-white"
                            : "bg-dark-800/40 border-dark-700 text-gray-400 hover:bg-dark-800 hover:border-dark-600"
                        }`}
                        style={
                          isActive
                            ? {
                                backgroundColor: brandBg(0.10),
                                borderColor: brandBg(0.40),
                              }
                            : undefined
                        }
                        title={doc.title}
                      >
                        <span className="max-w-[220px] truncate">{doc.title}</span>
                        {hasResults && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            analyzed
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="flex-1 min-h-0">
                <DocumentViewer
                  content={documentContent}
                  spans={docSpans}
                  selectedFinding={selectedFinding}
                  onSelectFinding={handleSelectFinding}
                />
              </div>
            </div>
          }
          right={
            <InsightsPanel
              results={resultsForPanel}
              checks={checks}
              selectedFinding={selectedFinding}
              onSelectFinding={handleSelectFinding}
              isAnalyzing={isAnalyzing}
            />
          }
        />
      </div>
    </AnimatedContent>
  );
}