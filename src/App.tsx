import React, { useEffect, useState } from 'react';
import LandingPage from './LandingPage';
import AppHub from './AppHub';
import { auth } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLanding, setShowLanding] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LandingPage onSignIn={() => setShowLanding(false)} initialError={authError} />;
  }

  if (showLanding) {
    return <LandingPage user={user} onGoToApp={() => setShowLanding(false)} />;
  }

  return (
    <div className="relative min-h-screen bg-black">
      {/* Header for authenticated user */}
      <div className="absolute top-0 left-0 w-full p-4 z-50 flex justify-between items-center pointer-events-none">
        <div className="pointer-events-auto">
          <button 
            onClick={() => setShowLanding(true)}
            className="p-2 pr-4 text-zinc-400 hover:text-white bg-zinc-900/50 hover:bg-zinc-800 backdrop-blur-md rounded-full border border-zinc-800 transition-colors flex items-center gap-2 shadow-lg"
          >
            <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center ml-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <span className="text-sm font-medium mr-1">Home Page</span>
          </button>
        </div>
        <div className="flex items-center space-x-4 pointer-events-auto">
          <div className="flex items-center space-x-2 bg-zinc-900/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-zinc-800">
             {user.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
             ) : (
                <div className="w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center text-xs text-white">
                  {user.email?.charAt(0).toUpperCase()}
                </div>
             )}
             <span className="text-sm text-zinc-300 font-medium hidden sm:block">{user.displayName || user.email}</span>
          </div>
        </div>
      </div>
      <AppHub />
    </div>
  );
}
