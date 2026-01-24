export default function ScoreCard({ label, score, color, description }) {
  const colorStyles = {
    pink: {
      stroke: '#f472b6',
      bg: 'bg-pink-500/10',
      text: 'text-pink-400',
    },
    amber: {
      stroke: '#fbbf24',
      bg: 'bg-amber-500/10',
      text: 'text-amber-400',
    },
    blue: {
      stroke: '#60a5fa',
      bg: 'bg-blue-500/10',
      text: 'text-blue-400',
    },
    purple: {
      stroke: '#a78bfa',
      bg: 'bg-purple-500/10',
      text: 'text-purple-400',
    },
  };

  const styles = colorStyles[color] || colorStyles.purple;
  const circumference = 2 * Math.PI * 36;
  const progress = ((100 - score) / 100) * circumference;

  return (
    <div className={`p-5 rounded-xl ${styles.bg} border border-dark-600`}>
      <div className="flex items-center gap-5">
        {/* Circular progress */}
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg className="w-20 h-20 transform -rotate-90">
            {/* Background circle */}
            <circle
              cx="40"
              cy="40"
              r="36"
              stroke="currentColor"
              strokeWidth="6"
              fill="none"
              className="text-dark-600"
            />
            {/* Progress circle */}
            <circle
              cx="40"
              cy="40"
              r="36"
              stroke={styles.stroke}
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={progress}
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          {/* Score text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-xl font-bold ${styles.text}`}>
              {score}
            </span>
          </div>
        </div>

        {/* Labels */}
        <div className="flex-1">
          <h3 className="text-white font-semibold mb-1">{label}</h3>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>
    </div>
  );
}
