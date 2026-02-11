import {
  Eye,
  Shield,
  Search,
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
          {/* Subtitle */}
          <p className="text-sm tracking-[0.2em] text-text-muted uppercase mb-8">
            Detect Bias, Fallacies &amp; Misinformation
          </p>

          {/* Thick editorial rule */}
          <div className="w-[520px] max-w-full h-[3px] bg-text-primary mx-auto mb-10" />

          {/* Main headline */}
          <h1 className="hero-headline text-5xl lg:text-7xl leading-tight tracking-tight mb-6 text-text-primary" style={{ fontFamily: "var(--font-serif)" }}>
            Make Bias, Fallacies,
            <br />
            <em style={{ fontFamily: "var(--font-serif)" }}>and Misinformation</em>
            <br />
            <em style={{ fontFamily: "var(--font-serif)" }}>Visible</em>
          </h1>

          {/* Thin rule separator */}
          <div className="w-[520px] max-w-full h-px bg-rule mx-auto mb-8" />

          <p className="text-lg text-text-muted max-w-2xl mx-auto mb-12 leading-relaxed">
            Our mission is to equalize the playing field of information by
            highlighting the subtle mistakes in language that give unfair
            persuasive power to a speaker's words.
          </p>

          {/* CTA Button */}
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
          >
            <button
              onClick={onGetStarted}
              className="px-8 py-4 bg-accent hover:bg-accent-hover text-white font-semibold transition-colors duration-200 flex items-center gap-2"
            >
              Analyze a Document
              <span className="ml-1">&rarr;</span>
            </button>
          </motion.div>
        </div>
      </section>

      {/* Info Cards Section */}
      <section className="bg-cream py-24">
        <div className="max-w-6xl mx-auto px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 bg-cream-dark border border-rule transition-colors hover:border-text-muted relative">
              <div className="flex items-start justify-between mb-6">
                <div className="w-10 h-10 flex items-center justify-center">
                  <Eye className="w-6 h-6 text-accent" />
                </div>
                <span className="text-sm text-text-faint" style={{ fontFamily: "var(--font-sans)" }}>01</span>
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

            <div className="p-8 bg-cream-dark border border-rule transition-colors hover:border-text-muted relative">
              <div className="flex items-start justify-between mb-6">
                <div className="w-10 h-10 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-fallacy" />
                </div>
                <span className="text-sm text-text-faint" style={{ fontFamily: "var(--font-sans)" }}>02</span>
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

            <div className="p-8 bg-cream-dark border border-rule transition-colors hover:border-text-muted relative">
              <div className="flex items-start justify-between mb-6">
                <div className="w-10 h-10 flex items-center justify-center">
                  <Search className="w-6 h-6 text-tactic" />
                </div>
                <span className="text-sm text-text-faint" style={{ fontFamily: "var(--font-sans)" }}>03</span>
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
        </div>
      </section>
    </div>
  );
}
