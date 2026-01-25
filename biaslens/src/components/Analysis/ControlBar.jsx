import { Zap } from 'lucide-react';

export default function ControlBar({ 
  checks, 
  onToggleCheck, 
  onAnalyze, 
  isAnalyzing,
  hasContent 
}) {
  const toggles = [
    { key: 'bias', label: 'Bias', color: 'pink' },
    { key: 'fallacies', label: 'Logical Fallacies', color: 'amber' },
    { key: 'tactic', label: 'Tactics', color: 'purple' },
    { key: 'factcheck', label: 'Fact Check', color: 'blue' },
  ];

  const getToggleStyles = (key, color) => {
    const isActive = checks[key];
    const colorMap = {
      pink: isActive 
        ? 'bg-pink-500/20 border-pink-500/50 text-pink-400' 
        : 'bg-dark-700 border-dark-600 text-gray-400 hover:border-pink-500/30 hover:text-pink-400',
      amber: isActive 
        ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' 
        : 'bg-dark-700 border-dark-600 text-gray-400 hover:border-amber-500/30 hover:text-amber-400',
      blue: isActive 
        ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' 
        : 'bg-dark-700 border-dark-600 text-gray-400 hover:border-blue-500/30 hover:text-blue-400',
      purple: isActive
        ? 'bg-purple-500/20 border-purple-500/50 text-purple-400'
        : 'bg-dark-700 border-dark-600 text-gray-400 hover:border-purple-500/30 hover:text-purple-400',
        };
    return colorMap[color];
  };

  return (
    <div className="h-16 px-6 bg-dark-900 border-b border-dark-700 flex items-center justify-between">
      {/* Toggle pills */}
      <div className="flex items-center gap-3">
        {toggles.map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => onToggleCheck(key)}
            className={`
              px-4 py-2 rounded-lg border text-sm font-medium
              transition-all duration-200
              ${getToggleStyles(key, color)}
            `}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Analyze button */}
      <button
        onClick={onAnalyze}
        disabled={!hasContent || isAnalyzing || !Object.values(checks).some(Boolean)}
        className={`
          flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold
          transition-all duration-300
          ${hasContent && !isAnalyzing && Object.values(checks).some(Boolean)
            ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/25 hover:shadow-purple-500/40'
            : 'bg-dark-700 text-gray-500 cursor-not-allowed'
          }
        `}
      >
        {isAnalyzing ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>Analyzing...</span>
          </>
        ) : (
          <>
            <Zap className="w-5 h-5" />
            <span>Analyze</span>
          </>
        )}
      </button>
    </div>
  );
}
