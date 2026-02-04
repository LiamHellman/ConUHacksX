import { useState, useEffect } from 'react';
import Header from './components/Layout/Header';
import Hero from './components/Landing/Hero';
import AnalysisPage from './components/Analysis/AnalysisPage';
import './App.css';

function App() {
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(mq.matches);
    update();

    if (mq.addEventListener) mq.addEventListener('change', update);
    else mq.addListener(update);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', update);
      else mq.removeListener(update);
    };
  }, []);

  // Hide scrollbar when showing analysis page
  useEffect(() => {
    if (showAnalysis && !isMobile) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showAnalysis, isMobile]);

  return (
    <div className="min-h-screen bg-dark-950">
      <Header 
        showAnalysis={showAnalysis} 
        onBackToHome={() => setShowAnalysis(false)} 
      />
      
      {showAnalysis ? (
        <AnalysisPage />
      ) : (
        <Hero onGetStarted={() => setShowAnalysis(true)} />
      )}
    </div>
  );
}

export default App;
