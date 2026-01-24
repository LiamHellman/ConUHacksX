import { Eye } from 'lucide-react';

export default function Header({ showAnalysis, onBackToHome }) {
  const handleLogoClick = () => {
    onBackToHome();
    // Scroll to top after a small delay to allow state change
    setTimeout(() => {
      const homeSection = document.getElementById('home');
      if (homeSection) {
        homeSection.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 10);
  };

  return (
    <header className="h-16 px-6 bg-dark-900/80 backdrop-blur-xl border-b border-dark-700 flex items-center justify-between sticky top-0 z-50">
      {/* Logo */}
      <button 
        onClick={handleLogoClick}
        className="flex items-center gap-3 hover:opacity-80 transition-opacity"
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center">
          <Eye className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold text-white">Factify</span>
      </button>

      {/* Nav */}
      <nav className="flex items-center gap-8">
        {!showAnalysis && (
          <a href="#about" className="text-gray-400 hover:text-white transition-colors text-sm font-medium">
            About
          </a>
        )}
        <button className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white border border-dark-500 hover:border-purple-500/50 rounded-lg transition-all">
          Sign In
        </button>
      </nav>
    </header>
  );
}
