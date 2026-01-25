import { useState, useEffect } from "react";
import UploadPanel from "./UploadPanel";
import ControlBar from "./ControlBar";
import DocumentViewer from "./DocumentViewer";
import InsightsPanel from "./InsightsPanel";
import { analyzeText } from "../../api/analyze";

// Mock analysis function - replace with actual API call
const runAnalysis = async () => {
  setIsAnalyzing(true);
  try {
    const data = await analyzeText(documentContent, { maxFindings: 10 });
    setResults(data);
  } finally {
    setIsAnalyzing(false);
  }
};

export default function AnalysisPage() {
  const [uploadedFile, setUploadedFile] = useState(null);
  const [pastedText, setPastedText] = useState("");
  const [documentContent, setDocumentContent] = useState("");
  const [checks, setChecks] = useState({
    bias: true,
    fallacies: true,
    factcheck: true,
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [selectedFinding, setSelectedFinding] = useState(null);

  // Handle file upload - read content
  useEffect(() => {
    if (uploadedFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setDocumentContent(e.target.result);
      };
      reader.readAsText(uploadedFile);
    }
  }, [uploadedFile]);

  // Handle pasted text
  useEffect(() => {
    if (pastedText) {
      setDocumentContent(pastedText);
    }
  }, [pastedText]);

  const handleToggleCheck = (key) => {
    setChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleAnalyze = async () => {
    if (!documentContent) return;

    setIsAnalyzing(true);
    setResults(null);
    setSelectedFinding(null);

    try {
      const data = await analyzeText(documentContent, {
        maxFindings: 10,
        // enabledFallacies: [...],
      });
      setResults(data);
    } catch (e) {
      console.error(e);
      // show an error banner/toast in UI
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSelectFinding = (finding) => {
    setSelectedFinding(finding);
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-dark-950">
      {/* Control bar */}
      <ControlBar
        checks={checks}
        onToggleCheck={handleToggleCheck}
        onAnalyze={handleAnalyze}
        onMediaTranscribe={(file, text) => setDocumentContent(text)}
        isAnalyzing={isAnalyzing}
        hasContent={!!documentContent}
      />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel - Upload */}
        <div className="w-80 border-r border-dark-700 bg-dark-900 flex-shrink-0">
          <UploadPanel
            onFileUpload={setUploadedFile}
            onTextPaste={setPastedText}
            onMediaTranscribe={(file, text) => setDocumentContent(text)}
            uploadedFile={uploadedFile}
            pastedText={pastedText}
          />
        </div>

        {/* Center panel - Document viewer */}
        <div className="flex-1 bg-dark-800 min-w-0">
          <DocumentViewer
            content={documentContent}
            findings={results?.findings}
            selectedFinding={selectedFinding}
            onSelectFinding={handleSelectFinding}
          />
        </div>

        {/* Right panel - Insights */}
        <div className="w-96 border-l border-dark-700 bg-dark-900 flex-shrink-0">
          <InsightsPanel
            results={results}
            checks={checks}
            selectedFinding={selectedFinding}
            onSelectFinding={handleSelectFinding}
            isAnalyzing={isAnalyzing}
          />
        </div>
      </div>
    </div>
  );
}
