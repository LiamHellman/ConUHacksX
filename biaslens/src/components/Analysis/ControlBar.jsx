import { Zap, AlertTriangle, Scale, Search } from 'lucide-react';
import GlareHover from '../GlareHover/GlareHover';
import Dock from '../Dock/Dock';

export default function ControlBar({ 
  checks, 
  onToggleCheck, 
  onAnalyze, 
  isAnalyzing,
  hasContent 
}) {
  const dockItems = [
    { 
      icon: <AlertTriangle size={22} />, 
      label: 'Bias Detection', 
      onClick: () => onToggleCheck('bias'),
      isActive: checks.bias,
      className: 'dock-item--pink'
    },
    { 
      icon: <Scale size={22} />, 
      label: 'Logical Fallacies', 
      onClick: () => onToggleCheck('fallacies'),
      isActive: checks.fallacies,
      className: 'dock-item--amber'
    },
    { 
      icon: <Search size={22} />, 
      label: 'Fact Check', 
      onClick: () => onToggleCheck('factcheck'),
      isActive: checks.factcheck,
      className: 'dock-item--blue'
    },
  ];

  return (
    <div className="h-20 px-6 bg-dark-900 border-b border-dark-700 flex items-center justify-between overflow-visible">
      {/* Dock toggle buttons */}
      <Dock 
        items={dockItems}
        panelHeight={56}
        baseItemSize={44}
        magnification={58}
        distance={150}
      />

      {/* Analyze button */}
      <GlareHover
        width="auto"
        height="auto"
        background="transparent"
        borderRadius="8px"
        borderColor="transparent"
        glareColor="#ffffff"
        glareOpacity={0.3}
        glareAngle={-30}
        glareSize={300}
        transitionDuration={800}
        style={{ opacity: hasContent && !isAnalyzing && Object.values(checks).some(Boolean) ? 1 : 0.5 }}
      >
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
      </GlareHover>
    </div>
  );
}
