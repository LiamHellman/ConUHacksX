import { useState, useEffect } from "react";
import UploadPanel from "./UploadPanel";
import ControlBar from "./ControlBar";
import DocumentViewer from "./DocumentViewer";
import InsightsPanel from "./InsightsPanel";
import AnimatedContent from "../AnimatedContent/AnimatedContent";
import { analyzeText } from "../../api/analyze";
import { FileText, Youtube, Music, Video as VideoIcon } from "lucide-react";

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
    if (history.length > 0) {
      localStorage.setItem("biaslens_history", JSON.stringify(history));
    }
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
          item.id === activeId ? { ...item, results: data } : item,
        ),
      );
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

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
                  file.type === "video/youtube" ? "youtube" : "video",
                )
              }
              uploadedFile={uploadedFile}
              pastedText={pastedText}
            />
          </div>

          {/* Bottom scrollable part: History List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="px-5 py-6">
              <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                Recent Sessions
              </h3>

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
            findings={results?.findings}
            selectedFinding={selectedFinding}
            onSelectFinding={setSelectedFinding}
          />
        </div>

        {/* --- RIGHT PANEL: Analysis Insights --- */}
        <div className="w-96 border-l border-dark-700 bg-dark-900 flex-shrink-0">
          <InsightsPanel
            results={results}
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
