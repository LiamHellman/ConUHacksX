import { Zap, Scale, AlertOctagon, Brain } from 'lucide-react';
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
      icon: <Brain size={22} />,
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
      icon: <AlertOctagon size={22} />,
      label: 'Tactics',
      onClick: () => onToggleCheck('tactic'),
      isActive: checks.tactic,
      className: 'dock-item--blue'
    },
  ];

  const anyOn = Object.values(checks).some(Boolean);

  return (
    <div className="h-20 px-6 bg-dark-900 border-b border-dark-700 flex items-center justify-between overflow-visible">
      <Dock
        items={dockItems}
        panelHeight={56}
        baseItemSize={44}
        magnification={58}
        distance={150}
      />

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
        style={{ opacity: hasContent && !isAnalyzing && anyOn ? 1 : 0.5 }}
      >
        <button
          onClick={onAnalyze}
          disabled={!hasContent || isAnalyzing || !anyOn}
          className={`
            flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold
            transition-all duration-300
            ${hasContent && !isAnalyzing && anyOn
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
