import { useState, useEffect } from 'react';
import UploadPanel from './UploadPanel';
import ControlBar from './ControlBar';
import DocumentViewer from './DocumentViewer';
import InsightsPanel from './InsightsPanel';

// Mock analysis function - replace with actual API call
const mockAnalyze = async (content, checks) => {
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const findings = [];
  let id = 0;

  if (checks.bias) {
    findings.push({
      id: id++,
      type: 'bias',
      label: 'Gender-coded language',
      severity: 'medium',
      start: content.indexOf('aggressive') !== -1 ? content.indexOf('aggressive') : 50,
      end: content.indexOf('aggressive') !== -1 ? content.indexOf('aggressive') + 10 : 65,
      originalText: content.slice(50, 65),
      explanation: 'This phrase contains language that may carry gender-based assumptions. Consider using more neutral alternatives.',
      suggestion: 'Consider replacing with more inclusive language that does not carry implicit gender associations.'
    });
    findings.push({
      id: id++,
      type: 'bias',
      label: 'Age-related assumption',
      severity: 'low',
      start: 120,
      end: 145,
      originalText: content.slice(120, 145),
      explanation: 'This statement makes assumptions based on age that may not be universally applicable.',
      suggestion: 'Reframe to focus on experience or skill level rather than age-related characteristics.'
    });
  }

  if (checks.fallacies) {
    findings.push({
      id: id++,
      type: 'fallacy',
      label: 'Ad hominem',
      severity: 'high',
      start: 200,
      end: 250,
      originalText: content.slice(200, 250),
      explanation: 'This argument attacks the person rather than addressing their argument directly.',
      suggestion: 'Focus on the merits of the argument itself rather than the characteristics of the person making it.'
    });
  }

  if (checks.factcheck) {
    findings.push({
      id: id++,
      type: 'factcheck',
      label: 'Unverified statistic',
      severity: 'medium',
      start: 300,
      end: 350,
      originalText: content.slice(300, 350),
      explanation: 'This claim includes a specific statistic that could not be independently verified. Consider citing a credible source.',
      suggestion: 'Add a citation from a reputable source, or qualify the statement to indicate its source.'
    });
  }

  return {
    scores: {
      bias: checks.bias ? 72 : null,
      fallacies: checks.fallacies ? 85 : null,
      factcheck: checks.factcheck ? 64 : null,
    },
    summary: 'This document shows moderate levels of potentially biased language and contains some unverified claims. The logical structure is generally sound with one notable exception. Consider reviewing the highlighted sections for more inclusive alternatives.',
    findings,
  };
};

export default function AnalysisPage() {
  const [uploadedFile, setUploadedFile] = useState(null);
  const [pastedText, setPastedText] = useState('');
  const [documentContent, setDocumentContent] = useState('');
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
    setChecks(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleAnalyze = async () => {
    if (!documentContent) return;
    
    setIsAnalyzing(true);
    setResults(null);
    setSelectedFinding(null);
    
    try {
      const analysisResults = await mockAnalyze(documentContent, checks);
      setResults(analysisResults);
    } catch (error) {
      console.error('Analysis failed:', error);
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
