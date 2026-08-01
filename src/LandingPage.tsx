import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Globe, BookOpen, User, ArrowRight, MessageSquare, Briefcase, GraduationCap, AlertCircle, LayoutDashboard } from 'lucide-react';
import { signInWithGoogle } from './lib/firebase';

interface LandingPageProps {
  onSignIn?: () => void;
  user?: any;
  onGoToApp?: () => void;
  initialError?: string | null;
}

export default function LandingPage({ onSignIn, user, onGoToApp, initialError }: LandingPageProps) {
  const [errorMsg, setErrorMsg] = useState<string | null>(initialError || null);

  React.useEffect(() => {
    if (initialError) {
      setErrorMsg(initialError);
    }
  }, [initialError]);

  const handleAction = async () => {
    if (user && onGoToApp) {
      onGoToApp();
      return;
    }
    
    try {
      setErrorMsg(null);
      await signInWithGoogle();
      if (onSignIn) onSignIn();
    } catch (error: any) {
      console.error(error);
      if (error?.code === 'auth/cancelled-popup-request' || error?.code === 'auth/popup-closed-by-user') {
        // Ignored or handle gracefully
        setErrorMsg('Sign-in popup was closed before completing. Please try again.');
      } else {
        setErrorMsg(`Failed to sign in: ${error?.message || error?.code || 'Unknown Error'}`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-indigo-500/30 overflow-y-auto">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-black/50 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Globe className="w-6 h-6 text-indigo-500" />
              <span className="text-xl font-bold text-white tracking-tight">LinguaConnect</span>
            </div>
            <button
              onClick={handleAction}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-lg shadow-indigo-500/25 flex items-center gap-2"
            >
              {user ? (
                <>
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </>
              ) : (
                "Sign up with Google"
              )}
            </button>
          </div>
        </div>
      </nav>

      {errorMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4">
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-4 rounded-xl flex items-start gap-3 backdrop-blur-md shadow-xl">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="text-sm leading-relaxed whitespace-pre-wrap">{errorMsg}</div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col items-center text-center">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none opacity-50" />
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className="text-indigo-400 font-medium tracking-wide uppercase text-sm mb-4 block">
            Master 33 Languages & Accelerate Your Career
          </span>
          <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight mb-6 max-w-4xl leading-tight">
            Speak with Confidence. Ace Your Interviews. Improve Your English.
          </h1>
          <p className="text-xl text-zinc-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Practice English and 32 other languages with an intelligent AI tutor. Build unstoppable confidence, elevate your communication skills, and prepare for high-stakes interviews with real-time feedback—all in one place.
          </p>
          <button
            onClick={handleAction}
            className="inline-flex items-center px-8 py-4 text-lg font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-lg shadow-indigo-500/25 active:scale-[0.98]"
          >
            {user ? "Go to Dashboard" : "Get Started"}
            <ArrowRight className="ml-2 w-5 h-5" />
          </button>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-[#0a0a0a] px-4 sm:px-6 lg:px-8 border-y border-zinc-800">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Why LinguaConnect?</h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">From mastering 33 languages to cracking your school science exams, get instant help with each and everything you need.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-[#18181b] p-6 rounded-2xl border border-zinc-800 hover:border-indigo-500/30 transition-colors"
              >
                <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Simple, Affordable Pricing</h2>
          <p className="text-zinc-400 max-w-2xl mx-auto">Science tutoring, exam preparation tools, and expert guidance for less than the price of a cup of tea. Pay smoothly via Easypaisa, JazzCash, or any Pakistani Debit/Credit card.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <div className="bg-[#18181b] p-8 rounded-3xl border border-zinc-800 flex flex-col">
            <h3 className="text-2xl font-bold text-white mb-2">Weekly Plan</h3>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-4xl font-bold text-indigo-400">Rs. 130</span>
              <span className="text-zinc-500">/ week</span>
            </div>
            <p className="text-zinc-400 mb-8 flex-grow">Perfect for urgent exam or interview prep.</p>
            <button
              onClick={handleAction}
              className="w-full py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-colors"
            >
              Choose Weekly
            </button>
          </div>

          <div className="bg-gradient-to-b from-indigo-900/20 to-[#18181b] p-8 rounded-3xl border border-indigo-500/30 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
              BEST VALUE
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Monthly Plan</h3>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-4xl font-bold text-indigo-400">Rs. 500</span>
              <span className="text-zinc-500">/ month</span>
            </div>
            <p className="text-zinc-400 mb-8 flex-grow">Best value for continuous, year-round learning.</p>
            <button
              onClick={handleAction}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors shadow-lg shadow-indigo-500/25"
            >
              Choose Monthly
            </button>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-[#0a0a0a] px-4 sm:px-6 lg:px-8 border-t border-zinc-800">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Frequently Asked Questions (FAQs)</h2>
          </div>

          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-[#18181b] p-6 rounded-2xl border border-zinc-800">
                <h4 className="text-lg font-semibold text-white mb-2 flex items-start">
                  <span className="text-indigo-500 mr-3">{index + 1}.</span>
                  {faq.question}
                </h4>
                <p className="text-zinc-400 pl-7 leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-12 bg-[#0a0a0a] px-4 sm:px-6 lg:px-8 border-t border-zinc-800">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Need Help?</h2>
          <p className="text-zinc-400 mb-6">
            For any issues or queries, please reach out to us:
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <div className="flex items-center gap-2 text-indigo-400 bg-indigo-500/10 px-4 py-2 rounded-full border border-indigo-500/20">
              <MessageSquare className="w-5 h-5" />
              <span className="font-medium">WhatsApp: 03141201151</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/20">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              <span className="font-medium">Email: azadali201151@gmail.com</span>
            </div>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="py-8 border-t border-zinc-800 text-center text-zinc-500 text-sm">
        <p>&copy; {new Date().getFullYear()} LinguaConnect. All rights reserved.</p>
      </footer>
    </div>
  );
}

const features = [
  {
    icon: <Globe className="w-6 h-6 text-indigo-400" />,
    title: "Speak 33 Languages",
    description: "Tap 'Start Call' to practice speaking English, Urdu, Arabic, Spanish, and 29 other languages with real-time feedback."
  },
  {
    icon: <GraduationCap className="w-6 h-6 text-indigo-400" />,
    title: "Smart Academic Tutor",
    description: "Confused by physics formulas or biology diagrams? Learn science concepts through simple, interactive lessons."
  },
  {
    icon: <BookOpen className="w-6 h-6 text-indigo-400" />,
    title: "Exam Guidance",
    description: "Upload your syllabus to get personalized study plans, mock exams, and step-by-step guidance for your exams."
  },
  {
    icon: <MessageSquare className="w-6 h-6 text-indigo-400" />,
    title: "Instant Q&A Help Desk",
    description: "Never get stuck on homework again. Ask any question about any subject and get clear, instant explanations."
  },
  {
    icon: <Briefcase className="w-6 h-6 text-indigo-400" />,
    title: "AI Mock Interviews",
    description: "Simulate real corporate, tech, or visa interviews with specialized feedback on confidence, grammar, and vocabulary."
  }
];

const faqs = [
  {
    question: "What exactly is LinguaConnect?",
    answer: "LinguaConnect is an interactive, all-in-one educational platform built for speaking practice, career preparation, school subject tutoring, and exam guidance. It acts as your personal 24/7 AI tutor for everything you need to learn."
  },
  {
    question: "Can I use the app to help with my school subjects and science?",
    answer: "Yes! LinguaConnect features a dedicated Academic Hub. You can learn complex science topics (Physics, Chemistry, Biology) and other school subjects through interactive, easy-to-understand breakdowns tailored to your grade level."
  },
  {
    question: "How does the app help me prepare for exams?",
    answer: "The app provides customized study guides, quick revision summaries, and realistic mock exams. It identifies your weak areas in any subject and guides you on exactly what to study next to boost your scores."
  },
  {
    question: "Can I ask specific questions when I get stuck on homework?",
    answer: "Absolutely! If you have a tough question or a confusing topic, simply type or drop it into our Q&A interface. The app provides immediate, step-by-step answers and explanations so you can truly understand the concept."
  },
  {
    question: "How many languages can I learn on the app?",
    answer: "We support 33 languages, including English, Urdu, Arabic, Spanish, French, Mandarin, and German. You can practice speaking them in real-time through interactive voice calls."
  },
  {
    question: "How does the Interview Preparation feature work?",
    answer: "Our system simulates real-world job or visa interview scenarios based on your specific industry. The app asks you questions via voice, listens to your answers, and gives you direct feedback on how to improve your speaking style, grammar, and professionalism."
  },
  {
    question: "How much does LinguaConnect cost, and how do I pay?",
    answer: "We offer two incredibly affordable plans: Weekly: Rs. 130, Monthly: Rs. 500. You can securely activate your premium features using Easypaisa, JazzCash, or any local bank card."
  },
  {
    question: "Is the app suitable for complete beginners or younger students?",
    answer: "Yes! When starting any language session or subject lesson, you can choose your level (Beginner, Intermediate, or Advanced). The app automatically adjusts its teaching speed and vocabulary to match your needs perfectly."
  }
];
