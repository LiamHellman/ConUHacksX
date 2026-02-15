import { ArrowLeft } from 'lucide-react';

export default function Header({ showAnalysis, onBackToHome }) {
  const handleLogoClick = () => {
    onBackToHome();
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
    <header className="header-root h-16 px-6 bg-cream flex items-center justify-between sticky top-0 z-50 flex-nowrap">
      {/* Logo */}
      <button
        onClick={handleLogoClick}
        className="header-logo flex items-center gap-3 hover:opacity-70 transition-opacity"
      >
        {showAnalysis && (
          <ArrowLeft className="w-4 h-4 text-text-muted" />
        )}
        <span className="header-title text-xl text-text-primary" style={{ fontFamily: "var(--font-serif)" }}>
          Factify
        </span>
      </button>

      {/* Nav */}
      <nav className="header-nav flex items-center gap-8">
        <span className="text-text-muted text-sm font-medium">
          Bias &amp; Fallacy Detection
        </span>
      </nav>
    </header>
  );
}
