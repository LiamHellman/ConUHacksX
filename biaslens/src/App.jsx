import { useState } from 'react';
import Header from './components/Layout/Header';
import Hero from './components/Landing/Hero';
import AnalysisPage from './components/Analysis/AnalysisPage';
import './App.css';

function App() {
  const [showAnalysis, setShowAnalysis] = useState(false);

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
