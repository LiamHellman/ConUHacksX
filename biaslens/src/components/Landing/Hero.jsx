import {
  AlertTriangle,
  Users,
  TrendingUp,
  Chrome,
  Download,
} from "lucide-react";
import { motion } from "motion/react";

export default function Hero({ onGetStarted }) {
  return (
    <div className="isolate">
      <section
        id="home"
        className="relative min-h-screen flex items-center justify-center overflow-hidden hero-section bg-cream"
      >
        <div className="relative z-10 max-w-4xl mx-auto px-8 text-center">
          {/* Thick editorial rule */}
          <div className="w-16 h-[3px] bg-text-primary mx-auto mb-10" />

          {/* Main headline */}
          <h1 className="hero-headline text-5xl lg:text-7xl leading-tight tracking-tight mb-6 text-text-primary" style={{ fontFamily: "var(--font-serif)" }}>
            Make{" "}
            <em className="text-accent" style={{ fontFamily: "var(--font-serif)" }}>Bias,</em>{" "}
            <em className="text-accent" style={{ fontFamily: "var(--font-serif)" }}>Fallacies,</em>
            <br />
            and{" "}
            <em className="text-accent" style={{ fontFamily: "var(--font-serif)" }}>Misinformation</em>{" "}
            Visible
          </h1>

          {/* Thin rule separator */}
          <div className="w-24 h-px bg-rule mx-auto mb-8" />

          <p className="text-lg text-text-muted max-w-2xl mx-auto mb-12 leading-relaxed">
            An AI-powered tool that deconstructs persuasive language, exposing hidden biases,
            logical fallacies, and manipulation tactics in any text.
          </p>

          {/* CTA Buttons */}
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
          >
            <button
              onClick={onGetStarted}
              className="px-8 py-4 bg-accent hover:bg-accent-hover text-white font-semibold transition-colors duration-200"
            >
              Analyze a Document
            </button>

            <a
              href="/extension/factify-extension.zip"
              download
              className="flex items-center gap-2 px-8 py-4 bg-white border border-rule text-text-primary font-semibold hover:border-text-primary transition-colors duration-200"
            >
              <Chrome className="w-5 h-5" />
              Get Chrome Extension
            </a>
          </motion.div>

          {/* Stats */}
          <div className="hero-stats mt-20 grid grid-cols-3 gap-8 max-w-2xl mx-auto">
            {[
              { value: "Explainable Results", label: "Every highlight shows why it matters" },
              { value: "Confidence Weighted", label: "No absolutes — just transparent signals" },
              { value: "Privacy First", label: "Your documents stay yours" },
            ].map((stat, i) => (
              <motion.div
                key={i}
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.6,
                  delay: 0.5 + i * 0.1,
                  ease: "easeOut",
                }}
              >
                <div className="hero-stat-value text-xl font-semibold text-text-primary mb-1" style={{ fontFamily: "var(--font-serif)" }}>
                  {stat.value}
                </div>
                <div className="hero-stat-label text-sm text-text-muted">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="bg-cream-dark py-24">
        <div className="max-w-6xl mx-auto px-8">
          {/* Mission */}
          <div className="text-center mb-20">
            <div className="w-16 h-[3px] bg-text-primary mx-auto mb-8" />
            <h2 className="text-4xl text-text-primary mb-6" style={{ fontFamily: "var(--font-serif)" }}>Our Mission</h2>
            <p className="text-lg text-text-muted max-w-3xl mx-auto leading-relaxed">
              Our mission is to equalize the playing field of information by
              highlighting the subtle mistakes in language that give unfair
              persuasive power to a speaker's words. Thus, allowing individuals
              to make clearer decisions on who to trust.
            </p>
          </div>

          {/* Facts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
            <div className="p-8 bg-white border border-rule transition-colors hover:border-text-muted">
              <div className="w-10 h-10 flex items-center justify-center mb-6">
                <AlertTriangle className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-xl text-text-primary mb-3" style={{ fontFamily: "var(--font-serif)" }}>
                The Misinformation Crisis
              </h3>
              <p className="text-text-muted leading-relaxed">
                Studies show that if you repeat a fallacy enough times, people
                will start to rate it as more truthful, even if they know it's
                logically flawed. Some studies show that the "truth rating" can
                increase by 20–30% with repetition alone.
              </p>
            </div>

            <div className="p-8 bg-white border border-rule transition-colors hover:border-text-muted">
              <div className="w-10 h-10 flex items-center justify-center mb-6">
                <Users className="w-6 h-6 text-fallacy" />
              </div>
              <h3 className="text-xl text-text-primary mb-3" style={{ fontFamily: "var(--font-serif)" }}>
                Impact of Biased Language
              </h3>
              <p className="text-text-muted leading-relaxed">
                Research reveals that biased language in job postings reduces
                applicant diversity by up to 40%. Subtle linguistic bias affects
                hiring, healthcare, education, and media without writers even
                realizing it.
              </p>
            </div>

            <div className="p-8 bg-white border border-rule transition-colors hover:border-text-muted">
              <div className="w-10 h-10 flex items-center justify-center mb-6">
                <TrendingUp className="w-6 h-6 text-tactic" />
              </div>
              <h3 className="text-xl text-text-primary mb-3" style={{ fontFamily: "var(--font-serif)" }}>
                Why It Matters
              </h3>
              <p className="text-text-muted leading-relaxed">
                Clear and honest communication is the foundation of intellectual
                discourse. Progress can be made when participants can exchange
                ideas openly. When discussions are robbed of honesty and
                clarity, they devolve into debates where winning trumps truth.
              </p>
            </div>
          </div>

          {/* Goals */}
          <div className="bg-white border border-rule p-10">
            <h3 className="text-2xl text-text-primary mb-6 text-center" style={{ fontFamily: "var(--font-serif)" }}>
              Our Goals
            </h3>
            <div className="w-12 h-px bg-rule mx-auto mb-8" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {[
                "Allow for people to make informed decisions based on the quality of information presented",
                "Increase awareness of cognitive biases and logical fallacies in everyday language",
                "Promote healthier discussions by encouraging critical thinking",
                "Provide tools to cross the gap between persuasion and truth",
              ].map((goal, i) => (
                <div key={i} className="flex items-start gap-4">
                  <span className="text-sm text-text-faint font-medium" style={{ fontFamily: "var(--font-mono)" }}>
                    0{i + 1}
                  </span>
                  <p className="text-text-body leading-relaxed">{goal}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
