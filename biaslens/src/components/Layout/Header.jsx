import { Eye } from 'lucide-react';

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
    <header className="header-root h-16 px-6 bg-cream border-b border-rule flex items-center justify-between sticky top-0 z-50 flex-nowrap">
      {/* Logo */}
      <button
        onClick={handleLogoClick}
        className="header-logo flex items-center gap-3 hover:opacity-70 transition-opacity"
      >
        <Eye className="w-5 h-5 text-accent" />
        <span className="header-title text-xl text-text-primary" style={{ fontFamily: "var(--font-serif)" }}>
          Factify
        </span>
      </button>

      {/* Nav */}
      <nav className="header-nav flex items-center gap-8">
        {!showAnalysis && (
          <a
            href="#about"
            className="text-text-muted hover:text-text-primary transition-colors text-sm font-medium"
          >
            About
          </a>
        )}
      </nav>
    </header>
  );
}
