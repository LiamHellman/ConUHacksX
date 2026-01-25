import { AlertTriangle, Users, TrendingUp, Chrome, Download } from 'lucide-react';
import { motion } from 'motion/react';
import Plasma from '../Plasma/Plasma';
import GlareHover from '../GlareHover/GlareHover';
import BlurText from '../BlurText/BlurText';
import ShinyText from '../ShinyText/ShinyText';

export default function Hero({ onGetStarted }) {
  return (
    <div className="isolate">
      <section id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Plasma background */}
        <Plasma color="#4c1d95" speed={0.5} opacity={0.4} />
        
        {/* Grid pattern overlay */}
        <div 
          className="absolute inset-0 opacity-5 z-[1]"
          style={{
            backgroundImage: `linear-gradient(rgba(139, 92, 246, 0.3) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(139, 92, 246, 0.3) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />

      <div className="relative z-10 max-w-5xl mx-auto px-8 text-center">
        {/* Main headline */}
        <h1 className="text-6xl lg:text-7xl font-bold leading-relaxed tracking-tight mb-16">
          <ShinyText 
            text="Make" 
            color="#ffffff" 
            shineColor="#c4b5fd" 
            speed={3} 
            delay={1}
            blurIn={true}
            blurDelay={0}
            className="text-6xl lg:text-7xl font-bold"
          />
          {" "}
          <ShinyText 
            text="Bias," 
            color="#a78bfa" 
            shineColor="#ffffff" 
            speed={3} 
            delay={1}
            blurIn={true}
            blurDelay={0.1}
            className="text-6xl lg:text-7xl font-bold"
          />
          {" "}
          <ShinyText 
            text="Fallacies," 
            color="#a78bfa" 
            shineColor="#ffffff" 
            speed={3} 
            delay={1}
            blurIn={true}
            blurDelay={0.2}
            className="text-6xl lg:text-7xl font-bold"
          />
          <br />
          <ShinyText 
            text="and" 
            color="#ffffff" 
            shineColor="#c4b5fd" 
            speed={3} 
            delay={1}
            blurIn={true}
            blurDelay={0.3}
            className="text-6xl lg:text-7xl font-bold"
          />
          {" "}
          <ShinyText 
            text="Misinformation" 
            color="#a78bfa" 
            shineColor="#ffffff" 
            speed={3} 
            delay={1}
            blurIn={true}
            blurDelay={0.4}
            className="text-6xl lg:text-7xl font-bold"
          />
          {" "}
          <ShinyText 
            text="Visible" 
            color="#ffffff" 
            shineColor="#c4b5fd" 
            speed={3} 
            delay={1}
            blurIn={true}
            blurDelay={0.5}
            className="text-6xl lg:text-7xl font-bold"
          />
        </h1>

        {/* CTA Button */}
        <motion.div 
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
          initial={{ filter: 'blur(10px)', opacity: 0, y: 20 }}
          animate={{ filter: 'blur(0px)', opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7, ease: 'easeOut' }}
        >
          <GlareHover
            width="auto"
            height="auto"
            background="transparent"
            borderRadius="12px"
            borderColor="transparent"
            glareColor="#ffffff"
            glareOpacity={0.3}
            glareAngle={-30}
            glareSize={300}
            transitionDuration={800}
          >
            <button
              onClick={onGetStarted}
              className="px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-purple-600/25 hover:shadow-purple-500/40"
            >
              Analyze a Document
            </button>
          </GlareHover>
          
          <GlareHover
            width="auto"
            height="auto"
            background="transparent"
            borderRadius="12px"
            borderColor="transparent"
            glareColor="#ffffff"
            glareOpacity={0.2}
            glareAngle={-30}
            glareSize={300}
            transitionDuration={800}
          >
            <a
              href="/factify-extension.zip"
              download
              className="flex items-center gap-2 px-8 py-4 bg-dark-800/80 hover:bg-dark-700 text-white font-semibold rounded-xl transition-all duration-300 border border-purple-500/30 hover:border-purple-500/50"
            >
              <Chrome className="w-5 h-5" />
              Get Chrome Extension
            </a>
          </GlareHover>
        </motion.div>

        {/* Stats */}
        <div className="mt-20 grid grid-cols-3 gap-8 max-w-2xl mx-auto">
          {[
            { value: '15+', label: 'Bias Categories' },
            { value: '25+', label: 'Fallacy Types' },
            { value: '99%', label: 'Accuracy Rate' },
          ].map((stat, i) => (
            <motion.div 
              key={i} 
              className="text-center"
              initial={{ filter: 'blur(10px)', opacity: 0, y: 20 }}
              animate={{ filter: 'blur(0px)', opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.9 + i * 0.1, ease: 'easeOut' }}
            >
              <div className="text-3xl font-bold text-purple-400 mb-1">{stat.value}</div>
              <div className="text-sm text-gray-500">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </div>

        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-dark-950 to-transparent" />
      </section>

      {/* About Section */}
      <section id="about" className="bg-dark-950 py-24">
        <div className="max-w-6xl mx-auto px-8">
          {/* Mission */}
          <div className="text-center mb-20">
            <h2 className="text-4xl font-bold text-white mb-6">Our Mission</h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
              We believe in a world where communication is fair, accurate, and inclusive. 
              Factify empowers writers, educators, journalists, and organizations to identify 
              hidden biases and misinformation in their content — fostering trust, understanding, 
              and equity in every conversation.
            </p>
          </div>

          {/* Facts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
            <div className="p-8 bg-dark-800/50 rounded-2xl border border-dark-700 hover:border-purple-500/30 transition-all">
              <div className="w-14 h-14 rounded-xl bg-pink-500/10 flex items-center justify-center mb-6">
                <AlertTriangle className="w-7 h-7 text-pink-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">The Misinformation Crisis</h3>
              <p className="text-gray-400 leading-relaxed">
                Studies show that false information spreads 6x faster than accurate news on social media. 
                Over 60% of people have unknowingly shared misinformation online, contributing to a growing 
                crisis of trust in digital communication.
              </p>
            </div>

            <div className="p-8 bg-dark-800/50 rounded-2xl border border-dark-700 hover:border-purple-500/30 transition-all">
              <div className="w-14 h-14 rounded-xl bg-amber-500/10 flex items-center justify-center mb-6">
                <Users className="w-7 h-7 text-amber-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Impact of Biased Language</h3>
              <p className="text-gray-400 leading-relaxed">
                Research reveals that biased language in job postings reduces applicant diversity by up to 40%. 
                Subtle linguistic bias affects hiring, healthcare, education, and media — often without 
                writers even realizing it.
              </p>
            </div>

            <div className="p-8 bg-dark-800/50 rounded-2xl border border-dark-700 hover:border-purple-500/30 transition-all">
              <div className="w-14 h-14 rounded-xl bg-blue-500/10 flex items-center justify-center mb-6">
                <TrendingUp className="w-7 h-7 text-blue-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Why It Matters</h3>
              <p className="text-gray-400 leading-relaxed">
                Inclusive and accurate communication builds stronger teams, more engaged audiences, and 
                greater public trust. Organizations with bias-aware content see 35% higher engagement 
                and improved reputation scores.
              </p>
            </div>
          </div>

          {/* Goals */}
          <div className="bg-gradient-to-r from-purple-900/20 to-purple-800/10 rounded-2xl border border-purple-500/20 p-10">
            <h3 className="text-2xl font-bold text-white mb-6 text-center">Our Goals</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {[
                'Make bias detection accessible to everyone, not just experts',
                'Educate users on logical fallacies without judgment or shame',
                'Promote fact-based discourse and verifiable claims',
                'Build AI tools that are transparent, explainable, and fair'
              ].map((goal, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-purple-400 font-bold">{i + 1}</span>
                  </div>
                  <p className="text-gray-300 leading-relaxed">{goal}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
