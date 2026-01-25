import { useRef, useEffect, useState } from 'react';

export default function DocumentViewer({ 
  content, 
  findings, 
  selectedFinding,
  onSelectFinding 
}) {
  const containerRef = useRef(null);
  const [highlightedContent, setHighlightedContent] = useState([]);

  useEffect(() => {
    if (!content || !findings || findings.length === 0) {
      setHighlightedContent([{ text: content, type: null, finding: null }]);
      return;
    }

    // Sort findings by start position
    const sortedFindings = [...findings].sort((a, b) => a.start - b.start);
    
    const segments = [];
    let lastEnd = 0;

    sortedFindings.forEach((finding) => {
      // Add unhighlighted text before this finding
      if (finding.start > lastEnd) {
        segments.push({
          text: content.slice(lastEnd, finding.start),
          type: null,
          finding: null
        });
      }

      // Add highlighted segment
      segments.push({
        text: content.slice(finding.start, finding.end),
        type: finding.type,
        finding: finding
      });

      lastEnd = finding.end;
    });

    // Add remaining unhighlighted text
    if (lastEnd < content.length) {
      segments.push({
        text: content.slice(lastEnd),
        type: null,
        finding: null
      });
    }

    setHighlightedContent(segments);
  }, [content, findings]);

  const getHighlightClass = (type, severity = 'low', isSelected) => {
    const base = 'cursor-pointer transition-all duration-200 rounded px-0.5 -mx-0.5';
    const selected = isSelected ? 'ring-2 ring-offset-2 ring-offset-dark-800' : '';

    const sev = {
      low:    { s: 'bg-opacity-100', v: 'bg-opacity-100' },    // unused placeholders
      medium: { s: 'bg-opacity-100', v: 'bg-opacity-100' },
      high:   { s: 'bg-opacity-100', v: 'bg-opacity-100' },
    };

    // Explicit classes so Tailwind definitely generates them
    const pick = (low, med, high) => (severity === 'high' ? high : severity === 'medium' ? med : low);

    switch (type) {
      case 'bias': {
        const bg = pick('bg-pink-500/15', 'bg-pink-500/30', 'bg-pink-500/45');
        const hover = 'hover:bg-pink-500/10';
        return `${base} ${selected} ${bg} ${hover} ${isSelected ? 'ring-pink-400' : ''}`;
      }
      case 'fallacy': {
        const bg = pick('bg-amber-500/15', 'bg-amber-500/30', 'bg-amber-500/45');
        const hover = 'hover:bg-amber-500/10';
        return `${base} ${selected} ${bg} ${hover} ${isSelected ? 'ring-amber-400' : ''}`;
      }
      case 'tactic': {
        const bg = pick('bg-blue-500/15', 'bg-blue-500/30', 'bg-blue-500/45');
        const hover = 'hover:bg-blue-500/10';
        return `${base} ${selected} ${bg} ${hover} ${isSelected ? 'ring-blue-400' : ''}`;
      }
      case 'factcheck': {
        const bg = pick('bg-purple-500/15', 'bg-purple-500/30', 'bg-purple-500/45');
        const hover = 'hover:bg-purple-500/10';
        return `${base} ${selected} ${bg} ${hover} ${isSelected ? 'ring-purple-400' : ''}`;
      }
      default:
        return '';
    }
  };

  if (!content) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <div className="w-20 h-20 rounded-2xl bg-dark-700 flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">No Document Loaded</h3>
        <p className="text-gray-500 max-w-sm">
          Upload a file or paste text in the left panel to begin analysis
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-dark-700 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Document</h2>
        {findings && findings.length > 0 && (
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-pink-400" />
              <span className="text-gray-400">Bias</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-400" />
              <span className="text-gray-400">Fallacy</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-400" />
              <span className="text-gray-400">Tactic</span>
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto p-6"
      >
        <div className="prose prose-invert max-w-none">
          <p className="text-gray-300 leading-relaxed whitespace-pre-wrap text-base">
            {highlightedContent.map((segment, idx) => (
              segment.type ? (
                <span
                  key={idx}
                  className={getHighlightClass(
                    segment.type,
                    segment.finding?.severity,
                    selectedFinding?.id === segment.finding?.id
                  )}
                  onClick={() => onSelectFinding(segment.finding)}
                >
                  {segment.text}
                </span>
              ) : (
                <span key={idx}>{segment.text}</span>
              )
            ))}
          </p>
        </div>
      </div>
    </div>
  );
}
