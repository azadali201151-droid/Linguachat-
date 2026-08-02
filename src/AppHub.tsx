/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { pcmToBase64, base64ToPcm } from './lib/audioUtils';
import { Mic, Phone, PhoneOff, Globe, BookOpen, CreditCard, Upload, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { auth, logout } from './lib/auth';
import { getUserProfile, UserProfile, updateTrialSeconds, activateSubscription } from './lib/db';

type AppState = 'idle' | 'connecting' | 'connected' | 'error' | 'payment';

export default function AppHub() {
  const [status, setStatus] = useState<AppState>('idle');
  const [language, setLanguage] = useState('English');
  const [difficulty, setDifficulty] = useState('beginner');
  const [errorMsg, setErrorMsg] = useState('');
  const [duration, setDuration] = useState(0);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [paymentRegion, setPaymentRegion] = useState<'pakistan' | 'other' | null>(null);
  const [paymentPlan, setPaymentPlan] = useState<'weekly' | 'monthly' | null>(null);
  const [paymentScreenshot, setPaymentScreenshot] = useState<string | null>(null);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const profileRef = useRef<UserProfile | null>(null);
  
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (auth.currentUser) {
        try {
          const p = await getUserProfile(auth.currentUser.uid, auth.currentUser.email || '');
          setProfile(p);
          
          // If plan ended, show payment
          if (p.subscriptionStatus === 'active' && p.planEndTimestamp && Date.now() > p.planEndTimestamp) {
             setStatus('payment');
          } else if (p.subscriptionStatus === 'expired') {
             setStatus('payment');
          } else if (p.subscriptionStatus === 'free_trial' && p.trialUsedSeconds >= 60) {
             setStatus('payment');
          }
        } catch (e) {
          console.error("Failed to fetch profile:", e);
        }
      }
    };
    fetchProfile();
  }, []);

  const checkDurationLimit = () => {
    setDuration((prev) => prev + 1);
  };

  useEffect(() => {
    const currentProfile = profileRef.current;
    if (currentProfile?.subscriptionStatus === 'free_trial') {
      if (currentProfile.trialUsedSeconds + duration >= 60 && status === 'connected') {
         stopSession();
         setStatus('payment');
         if (auth.currentUser) {
           updateTrialSeconds(auth.currentUser.uid, currentProfile.trialUsedSeconds + duration).catch(e => console.error(e));
           setProfile({...currentProfile, trialUsedSeconds: currentProfile.trialUsedSeconds + duration});
         }
      }
    }
  }, [duration, status]);

  const startSession = async () => {
    if (profile?.subscriptionStatus === 'free_trial' && profile.trialUsedSeconds >= 60) {
       setStatus('payment');
       return;
    }
    if (profile?.subscriptionStatus === 'expired' || (profile?.subscriptionStatus === 'active' && profile.planEndTimestamp && Date.now() > profile.planEndTimestamp)) {
       setStatus('payment');
       return;
    }

    setStatus('connecting');
    setErrorMsg('');
    setDuration(0);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorMsg("Microphone access is not supported or permission is denied.");
        setStatus('error');
        return;
    }

    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;
      nextStartTimeRef.current = audioCtx.currentTime;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      let apiKeyToUse = '';
      try {
        const res = await fetch('/api/env');
        const data = await res.json();
        apiKeyToUse = data.apiKey;
      } catch (e) {
        console.error("Failed to fetch /api/env", e);
      }
      if (!apiKeyToUse && (import.meta as any).env.VITE_GEMINI_API_KEY) {
        apiKeyToUse = (import.meta as any).env.VITE_GEMINI_API_KEY;
      }

      if (apiKeyToUse) {
        // Direct browser-to-Gemini connection
        const ai = new GoogleGenAI({ apiKey: apiKeyToUse });
        const session = await ai.live.connect({
          model: "gemini-2.0-flash-exp",
          callbacks: {
            onmessage: (message: LiveServerMessage) => {
              const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
              if (audio) {
                playAudioChunk(audioCtx, audio).catch(console.error);
              }
              if (message.serverContent?.interrupted) {
                nextStartTimeRef.current = audioCtx.currentTime;
              }
            },
          },
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: "Puck"
                }
              }
            },
            systemInstruction: `You are a conversational language practice partner for someone learning ${language}. The user's difficulty level is ${difficulty}. Keep your responses short and natural. Provide feedback when they make mistakes, but focus primarily on keeping the conversation flowing. Start the conversation right away in ${language}. Use a realistic human male voice.`
          },
        });

        // Store session in wsRef to re-use stop logic (we just need a close method)
        wsRef.current = {
          close: () => session.close(),
          readyState: WebSocket.OPEN,
          send: (data: string) => {
            const { audio } = JSON.parse(data);
            if (audio) {
              session.sendRealtimeInput({
                audio: { data: audio, mimeType: "audio/pcm;rate=16000" }
              });
            }
          }
        } as any;

        setStatus('connected');
        durationIntervalRef.current = setInterval(() => {
          checkDurationLimit();
        }, 1000);

        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;
        
        processor.onaudioprocess = (e) => {
           try {
              const inputData = e.inputBuffer.getChannelData(0);
              const base64 = pcmToBase64(inputData);
              wsRef.current?.send(JSON.stringify({ audio: base64 }));
           } catch (err) {
             console.error("onaudioprocess error:", err);
           }
        };

        const source = audioCtx.createMediaStreamSource(stream);
        sourceRef.current = source;
        source.connect(processor);
        processor.connect(audioCtx.destination);
      } else {
        // Fallback to local websocket server if no direct API key is available
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = (import.meta as any).env.VITE_WS_URL || `${protocol}//${window.location.host}`;
        const cleanWsHost = wsHost.replace(/\/$/, '');
        const wsUrl = `${cleanWsHost}/live?language=${encodeURIComponent(language)}&difficulty=${encodeURIComponent(difficulty)}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setStatus('connected');
          durationIntervalRef.current = setInterval(() => {
            checkDurationLimit();
          }, 1000);
        };

        ws.onmessage = async (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.error) {
               stopSession();
               setErrorMsg(msg.error);
               setStatus('error');
               return;
            }

            if (msg.interrupted) {
              nextStartTimeRef.current = audioCtx.currentTime;
            }

            if (msg.audio) {
              playAudioChunk(audioCtx, msg.audio).catch(console.error);
            }
          } catch (err) {
            console.error("onmessage parse error:", err);
          }
        };

        ws.onerror = (e) => {
          stopSession();
          setErrorMsg("Failed to connect to server. If deployed on Vercel, note that Vercel doesn't support WebSocket servers. Please deploy your backend to Render or Railway, or add GEMINI_API_KEY to your Vercel Environment Variables.");
          setStatus('error');
        };

        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;
        
        processor.onaudioprocess = (e) => {
           try {
             if (ws.readyState === WebSocket.OPEN) {
                const inputData = e.inputBuffer.getChannelData(0);
                const base64 = pcmToBase64(inputData);
                ws.send(JSON.stringify({ audio: base64 }));
             }
           } catch (err) {
             console.error("onaudioprocess error:", err);
           }
        };

        const source = audioCtx.createMediaStreamSource(stream);
        sourceRef.current = source;
        source.connect(processor);
        processor.connect(audioCtx.destination);
      }
    } catch (err: any) {
      stopSession();
      setErrorMsg(err?.name === 'NotAllowedError' ? "Microphone permission denied. To use voice features, please click the 'Open in new tab' button at the top right of the preview." : err?.message || "Could not access microphone.");
      setStatus('error');
    }
  };

  const playAudioChunk = async (audioCtx: AudioContext, base64Audio: string) => {
    try {
      const pcmData = base64ToPcm(base64Audio);
      if (pcmData.length === 0) return;
      const audioBuffer = audioCtx.createBuffer(1, pcmData.length, 24000); // the only fix to keep it sounding normal
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < pcmData.length; i++) {
        channelData[i] = pcmData[i] / 32768.0;
      }

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);

      if (nextStartTimeRef.current < audioCtx.currentTime) {
        nextStartTimeRef.current = audioCtx.currentTime;
      }
      source.start(nextStartTimeRef.current);
      nextStartTimeRef.current += audioBuffer.duration;
    } catch (err) {
      console.error("Audio playback error:", err);
    }
  };

  const stopSession = () => {
    setStatus('idle');
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    
    if (processorRef.current) {
        try {
            processorRef.current.disconnect();
        } catch (e) {
            console.error(e);
        }
    }
    if (sourceRef.current) {
        try {
            sourceRef.current.disconnect();
        } catch (e) {
            console.error(e);
        }
    }
    if (wsRef.current) {
        wsRef.current.close();
    }
    if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioCtxRef.current) {
        try {
            audioCtxRef.current.close();
        } catch (e) {
            console.error(e);
        }
    }
    
    wsRef.current = null;
    processorRef.current = null;
    sourceRef.current = null;
    mediaStreamRef.current = null;
    audioCtxRef.current = null;
  };

  const handlePaymentSubmit = async () => {
    if (!paymentScreenshot || !paymentPlan || !paymentRegion) {
      setPaymentError("Please select a plan and upload a screenshot.");
      return;
    }
    setVerifyingPayment(true);
    setPaymentError('');

    try {
      const res = await fetch('/api/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: paymentScreenshot,
          plan: paymentPlan,
          region: paymentRegion
        })
      });

      const data = await res.json();
      if (res.ok && data.verified) {
        if (auth.currentUser) {
          await activateSubscription(auth.currentUser.uid, paymentPlan, paymentRegion);
          const p = await getUserProfile(auth.currentUser.uid, auth.currentUser.email || '');
          setProfile(p);
          setStatus('idle');
          setPaymentScreenshot(null);
          setPaymentPlan(null);
          setPaymentRegion(null);
        }
      } else {
         setPaymentError(data.error || "Payment verification failed. Please ensure the screenshot is clear and recent (within 6 days).");
      }
    } catch (e: any) {
      setPaymentError(e.message || "An error occurred during verification.");
    } finally {
      setVerifyingPayment(false);
    }
  };

  const handlePromoCodeSubmit = async () => {
    if (!promoCode) {
      setPaymentError("Please enter a promo code.");
      return;
    }
    if (promoCode.trim() === 'Azad1122') {
      if (auth.currentUser) {
        setVerifyingPayment(true);
        setPaymentError('');
        try {
          await activateSubscription(auth.currentUser.uid, 'monthly', 'promo');
          const p = await getUserProfile(auth.currentUser.uid, auth.currentUser.email || '');
          setProfile(p);
          setStatus('idle');
          setPromoCode('');
        } catch (e: any) {
           setPaymentError(e.message || "An error occurred applying the promo code.");
        } finally {
          setVerifyingPayment(false);
        }
      }
    } else {
      setPaymentError('Invalid promo code');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPaymentScreenshot(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    return () => {
      stopSession();
    };
  }, []);

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-indigo-500/30 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      
      {/* Ambient background glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/5 rounded-full pointer-events-none opacity-50 hidden md:block" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full pointer-events-none opacity-30 hidden md:block" />

      {status !== 'idle' && (
        <button 
          onClick={() => {
            if (status === 'connected' || status === 'connecting') stopSession();
            setStatus('idle');
          }}
          className="absolute top-20 left-4 p-2 pr-4 text-zinc-400 hover:text-white bg-zinc-900/80 hover:bg-zinc-800 backdrop-blur-md rounded-full transition-colors z-50 flex items-center gap-2 border border-zinc-800/50"
          title="Back to Dashboard"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Dashboard</span>
        </button>
      )}

      <AnimatePresence mode="wait">
        {status === 'payment' ? (
           <motion.div 
             key="payment"
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             exit={{ opacity: 0, y: -20, scale: 0.95 }}
             className="w-full max-w-md bg-[#18181b] border border-zinc-800 rounded-3xl p-6 shadow-2xl relative z-10 max-h-[90vh] overflow-y-auto"
           >
             <div className="text-center mb-6 mt-4">
               <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-4 mx-auto">
                 <CreditCard className="w-6 h-6 text-indigo-400" />
               </div>
               <h2 className="text-2xl font-bold text-white mb-2">Pay Now to Use Unlimited</h2>
               <p className="text-zinc-400 text-sm leading-relaxed">
                 You have reached your 60-second free trial limit or your plan has ended. Please choose a plan to continue with unlimited access.
               </p>
             </div>

             {paymentError && (
               <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs text-center">
                 {paymentError}
               </div>
             )}

             <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2 block">Region</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setPaymentRegion('pakistan')}
                      className={`py-2 rounded-xl text-sm font-medium transition-colors ${paymentRegion === 'pakistan' ? 'bg-indigo-600 text-white' : 'bg-[#0a0a0a] text-zinc-400 border border-zinc-800 hover:bg-zinc-900'}`}
                    >
                      Pakistan
                    </button>
                    <button
                      onClick={() => setPaymentRegion('other')}
                      className={`py-2 rounded-xl text-sm font-medium transition-colors ${paymentRegion === 'other' ? 'bg-indigo-600 text-white' : 'bg-[#0a0a0a] text-zinc-400 border border-zinc-800 hover:bg-zinc-900'}`}
                    >
                      Other
                    </button>
                  </div>
                </div>

                {paymentRegion && (
                  <div>
                    <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2 block">Select Plan</label>
                    <div className="space-y-2">
                      <button
                        onClick={() => setPaymentPlan('weekly')}
                        className={`w-full p-4 rounded-xl border text-left transition-all ${paymentPlan === 'weekly' ? 'border-indigo-500 bg-indigo-500/10' : 'border-zinc-800 bg-[#0a0a0a] hover:border-zinc-700'}`}
                      >
                        <div className="font-semibold text-white">Weekly Plan</div>
                        <div className="text-sm text-zinc-400 mt-1">{paymentRegion === 'pakistan' ? 'Rs. 130 / week' : '$3 / week'}</div>
                      </button>
                      <button
                        onClick={() => setPaymentPlan('monthly')}
                        className={`w-full p-4 rounded-xl border text-left transition-all ${paymentPlan === 'monthly' ? 'border-indigo-500 bg-indigo-500/10' : 'border-zinc-800 bg-[#0a0a0a] hover:border-zinc-700'}`}
                      >
                        <div className="font-semibold text-white">Monthly Plan</div>
                        <div className="text-sm text-zinc-400 mt-1">{paymentRegion === 'pakistan' ? 'Rs. 500 / month' : '$10 / month'}</div>
                      </button>
                    </div>
                  </div>
                )}

                {paymentPlan && (
                  <div className="pt-4 border-t border-zinc-800">
                    <div className="bg-[#0a0a0a] p-4 rounded-xl border border-zinc-800 mb-4">
                      <p className="text-sm text-zinc-300 mb-2 font-medium">Payment Instructions:</p>
                      <p className="text-xs text-zinc-400 mb-1">
                        {paymentRegion === 'pakistan' ? 'Send local transfer to:' : 'Send payment to:'}
                      </p>
                      <div className="font-mono text-indigo-400 text-sm bg-zinc-900 p-2 rounded-lg break-all">
                        {paymentRegion === 'pakistan' ? '03141201151' : 'PK82SADA0000003141201151'}
                      </div>
                      <p className="text-xs text-zinc-500 mt-2">After transferring, upload a screenshot of your payment receipt below.</p>
                    </div>

                    <div className="space-y-2">
                       <input 
                         type="file" 
                         accept="image/*" 
                         className="hidden" 
                         ref={fileInputRef}
                         onChange={handleFileChange}
                       />
                       <button
                         onClick={() => fileInputRef.current?.click()}
                         className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-300 text-sm font-medium transition-colors flex items-center justify-center"
                       >
                         <Upload className="w-4 h-4 mr-2" />
                         {paymentScreenshot ? 'Screenshot Selected' : 'Upload Screenshot'}
                       </button>

                       {paymentScreenshot && (
                         <div className="mt-2 h-32 w-full rounded-xl overflow-hidden border border-zinc-800 relative">
                           <img src={paymentScreenshot} alt="Payment" className="w-full h-full object-cover" />
                         </div>
                       )}

                       <button
                         onClick={handlePaymentSubmit}
                         disabled={verifyingPayment || !paymentScreenshot}
                         className={`w-full py-3.5 mt-4 rounded-xl font-medium transition-all flex items-center justify-center ${verifyingPayment || !paymentScreenshot ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'}`}
                       >
                         {verifyingPayment ? (
                           <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                         ) : (
                           'Verify Payment'
                         )}
                       </button>
                    </div>
                  </div>
                )}
                
                <div className="pt-4 border-t border-zinc-800">
                  <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2 block">Have a Promo Code?</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      placeholder="Enter promo code"
                      className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                    <button 
                      onClick={handlePromoCodeSubmit}
                      disabled={!promoCode || verifyingPayment}
                      className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Apply
                    </button>
                  </div>
                </div>
             </div>
           </motion.div>
        ) : status === 'idle' || status === 'error' ? (

          <motion.div 
            key="setup"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="w-full max-w-md"
          >
            <div className="text-center mb-10 flex flex-col items-center">
              <div className="flex items-center justify-center w-16 h-16 rounded-3xl bg-[#1a1a2e] border border-indigo-500/20 mb-6 shadow-[0_0_30px_rgba(99,102,241,0.2)]">
                <Globe className="w-8 h-8 text-indigo-400" />
              </div>
              <h1 className="text-4xl font-semibold tracking-tight text-white mb-3">LinguaConnect</h1>
              <p className="text-zinc-400 text-base max-w-sm mx-auto leading-relaxed">Real-time conversational practice.</p>
            </div>

            <div className="bg-[#18181b] border border-zinc-800 rounded-3xl p-6 shadow-2xl">
              {status === 'error' && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
                  {errorMsg}
                </div>
              )}

              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-sm font-medium text-zinc-300 flex items-center">
                    <Globe className="w-4 h-4 mr-2 text-zinc-400" />
                    Target Language
                  </label>
                  <select 
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-zinc-800 rounded-xl px-4 py-3.5 text-zinc-200 outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all appearance-none cursor-pointer"
                  >
                    <option>English</option>
                    <option>Spanish</option>
                    <option>French</option>
                    <option>German</option>
                    <option>Italian</option>
                    <option>Portuguese</option>
                    <option>Dutch</option>
                    <option>Russian</option>
                    <option>Chinese</option>
                    <option>Japanese</option>
                    <option>Korean</option>
                    <option>Arabic</option>
                    <option>Hindi</option>
                    <option>Urdu</option>
                    <option>Turkish</option>
                    <option>Swedish</option>
                    <option>Polish</option>
                    <option>Indonesian</option>
                    <option>Vietnamese</option>
                    <option>Thai</option>
                    <option>Hebrew</option>
                    <option>Greek</option>
                    <option>Bengali</option>
                    <option>Punjabi</option>
                    <option>Tamil</option>
                    <option>Telugu</option>
                    <option>Marathi</option>
                    <option>Gujarati</option>
                    <option>Persian</option>
                    <option>Swahili</option>
                    <option>Malay</option>
                    <option>Tagalog</option>
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-zinc-300 flex items-center">
                    <BookOpen className="w-4 h-4 mr-2 text-zinc-400" />
                    Difficulty Level
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['beginner', 'intermediate', 'advanced'].map((level) => (
                      <button
                        key={level}
                        onClick={() => setDifficulty(level)}
                        className={`py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                          difficulty === level
                            ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                            : 'bg-[#0a0a0a] text-zinc-400 border border-zinc-800 hover:bg-zinc-900'
                        }`}
                      >
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={startSession}
                  className="w-full mt-4 flex items-center justify-center py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors shadow-lg shadow-indigo-500/25 active:scale-[0.98]"
                >
                  <Phone className="w-5 h-5 mr-2" />
                  Start Call
                </button>
              </div>
            </div>
          </motion.div>
        ) : status === 'connecting' ? (
          <motion.div 
            key="connecting"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center"
          >
            <div className="w-20 h-20 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mb-6" />
            <p className="text-zinc-400 font-medium animate-pulse">Connecting...</p>
          </motion.div>
        ) : (
          <motion.div 
            key="call"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center"
          >
            <div className="w-32 h-32 bg-indigo-500/10 border border-indigo-500/20 rounded-full flex items-center justify-center mb-8 relative">
               <div className="absolute inset-0 rounded-full border border-indigo-500/30 animate-ping opacity-50" />
               <Mic className="w-12 h-12 text-indigo-400" />
            </div>
            
            <h2 className="text-2xl font-medium tracking-tight text-white mb-2">
              Speaking {language}
            </h2>
            <div className="flex flex-col items-center mb-12 space-y-3">
              <p className="text-indigo-300/80 text-sm bg-indigo-500/10 px-4 py-1.5 rounded-full border border-indigo-500/20">
                {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Level
              </p>
              <div className="text-4xl font-mono font-light text-white tracking-wider">
                {Math.floor(duration / 60).toString().padStart(2, '0')}:{(duration % 60).toString().padStart(2, '0')}
              </div>
            </div>

            <button 
              onClick={stopSession}
              className="w-16 h-16 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-red-500/25 transition-transform active:scale-95"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
