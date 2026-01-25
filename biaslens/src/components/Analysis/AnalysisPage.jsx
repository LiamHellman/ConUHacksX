import { useState, useEffect, useMemo, useRef } from "react";
import { applyThemeVars } from "../../theme/colors";
import UploadPanel from "./UploadPanel";
import ControlBar from "./ControlBar";
import DocumentViewer from "./DocumentViewer";
import InsightsPanel from "./InsightsPanel";
import AnimatedContent from "../AnimatedContent/AnimatedContent";
import Split from "react-split";
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

export default function AnalysisPage() {
  // (keep all hooks and logic above this)
  // ...all hooks and logic above...
  return (
    <AnimatedContent className="h-[calc(100vh-64px)] flex flex-col bg-dark-950">
      <ControlBar
        checks={checks}
        onToggleCheck={(key) => setChecks((prev) => ({ ...prev, [key]: !prev[key] }))}
        onAnalyze={handleAnalyze}
        isAnalyzing={isAnalyzing}
        hasContent={!!documentContent}
      />
      <Split
        className="flex-1 flex overflow-hidden"
        sizes={[20, 50, 30]}
        minSize={[200, 300, 250]}
        expandToMin={true}
        gutterSize={8}
        direction="horizontal"
        style={{ display: 'flex', width: '100%', height: '100%' }}
      >
        {/* LEFT: Upload + Sessions */}
        <div className="border-r border-dark-700 bg-dark-900 flex flex-col h-full min-w-0">
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
                  entry.upgraded = true;
                  renameSession(entry.sessionId, `${entry.firstTitle} …`);
                }
                const doc = makeDoc({
                  title: file.name,
                  content: text,
                  type,
                });
                addDocToSession(entry.sessionId, doc);
              }}
            />
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
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
                              borderColor: brandFg(0.50),
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

        {/* CENTER: Document tabs + DocumentViewer */}
        <div className="bg-dark-800 min-w-0 flex flex-col">
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

        {/* RIGHT: Insights */}
        <div className="min-w-0 border-l border-dark-700 bg-dark-900 flex flex-col">
          <InsightsPanel
            results={resultsForPanel}
            checks={checks}
            selectedFinding={selectedFinding}
            onSelectFinding={handleSelectFinding}
            isAnalyzing={isAnalyzing}
          />
        </div>
      </Split>
    </AnimatedContent>
  );
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
}

