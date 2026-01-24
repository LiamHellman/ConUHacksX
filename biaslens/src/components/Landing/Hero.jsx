import { ArrowRight, Sparkles } from 'lucide-react';

export default function Hero({ onGetStarted }) {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/15 rounded-full blur-3xl animate-pulse delay-1000" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-700/10 rounded-full blur-3xl" />
      
      {/* Grid pattern overlay */}
      <div 
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `linear-gradient(rgba(139, 92, 246, 0.3) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(139, 92, 246, 0.3) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto px-8 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-dark-700/80 border border-dark-500/50 mb-8">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="text-sm text-gray-300">AI-Powered Document Analysis</span>
        </div>

        {/* Main headline */}
        <h1 className="text-6xl lg:text-7xl font-bold leading-tight tracking-tight mb-6">
          <span className="text-white">Make </span>
          <span className="bg-gradient-to-r from-purple-400 via-purple-500 to-purple-600 bg-clip-text text-transparent">
            Bias, Fallacies,
          </span>
          <br />
          <span className="text-white">and </span>
          <span className="bg-gradient-to-r from-purple-500 to-purple-400 bg-clip-text text-transparent">
            Misinformation
          </span>
          <span className="text-white"> Visible</span>
        </h1>

        {/* Subtext */}
        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed">
          BiasLens analyzes your documents for hidden bias, logical fallacies, and unverified claims — 
          helping you communicate with clarity, fairness, and credibility.
        </p>

        {/* CTA Buttons */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={onGetStarted}
            className="group inline-flex items-center gap-3 px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-purple-600/25 hover:shadow-purple-500/40 hover:scale-105"
          >
            Analyze a Document
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
          <button className="px-8 py-4 border border-dark-500 hover:border-purple-500/50 text-gray-300 hover:text-white font-medium rounded-xl transition-all duration-300 hover:bg-dark-700/50">
            Learn More
          </button>
        </div>

        {/* Stats */}
        <div className="mt-20 grid grid-cols-3 gap-8 max-w-2xl mx-auto">
          {[
            { value: '15+', label: 'Bias Categories' },
            { value: '25+', label: 'Fallacy Types' },
            { value: '99%', label: 'Accuracy Rate' },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-3xl font-bold text-purple-400 mb-1">{stat.value}</div>
              <div className="text-sm text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-dark-950 to-transparent" />
    </section>
  );
}
