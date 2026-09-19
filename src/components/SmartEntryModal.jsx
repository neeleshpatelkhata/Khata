import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useLedgerStore } from '../store/ledgerStore';
import { usePreferencesStore } from '../store/preferencesStore';
import { parseNaturalLanguagePrompt, transcribeAudio } from '../services/geminiService';
import { parseNaturalLanguageEntry } from '../services/smartEntryParser';
import {
  X,
  Mic,
  MicOff,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  DollarSign,
  User,
  Tag,
  ArrowLeftRight,
  Loader2,
  ShieldCheck,
  Zap,
  AlertTriangle
} from 'lucide-react';

// Friendly copy for every Web Speech API error code we can hit.
const SPEECH_ERROR_MESSAGES = {
  'not-allowed': 'Microphone access was denied. Enable the microphone for this app in your phone Settings → Apps → Khata.Pro → Permissions, then try again.',
  'permission-denied': 'Microphone access was denied. Enable the microphone for this app in your phone Settings → Apps → Khata.Pro → Permissions, then try again.',
  'service-not-allowed': 'Speech recognition service is not available right now. Please type your entry instead.',
  'no-speech': 'No speech detected. Tap the mic and try speaking again.',
  'audio-capture': 'No microphone was found on this device.',
  'network': 'Voice input needs an internet connection. Check your network and try again.'
};

export default function SmartEntryModal({ isOpen, onClose }) {
  const { currentWorkspace } = useAuthStore();
  const { addTransaction, parties } = useLedgerStore();
  const { lang } = usePreferencesStore();
  const speechLang = lang === 'HI' ? 'hi-IN' : 'en-IN';

  const [promptText, setPromptText] = useState('');
  const [selectedType, setSelectedType] = useState('DEBIT');
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [aiStatusMsg, setAiStatusMsg] = useState('');

  // Mic lifecycle: 'idle' | 'listening' | 'processing' | 'error'
  const [micStatus, setMicStatus] = useState('idle');
  const [micError, setMicError] = useState('');
  const isListening = micStatus === 'listening';

  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const discardOnStopRef = useRef(false);
  const cleanupMicRef = useRef(() => {});

  // Overrides set by Gemini AI if successful
  const [aiParsedAmount, setAiParsedAmount] = useState(null);
  const [aiParsedParty, setAiParsedParty] = useState(null);
  const [aiParsedCategory, setAiParsedCategory] = useState(null);

  // Compute NLP results reactively from smartEntryParser
  const nlpResult = useMemo(() => {
    return parseNaturalLanguageEntry(promptText);
  }, [promptText]);

  // The modal never unmounts on close (the parent just stops rendering it
  // via `isOpen`), so recognition/recording must be torn down explicitly
  // here rather than relying on an unmount effect that would never fire.
  useEffect(() => {
    if (!isOpen) cleanupMicRef.current();
    return () => cleanupMicRef.current();
  }, [isOpen]);

  if (!isOpen) return null;

  const parsedAmount = aiParsedAmount !== null ? aiParsedAmount : String(nlpResult.amount || '0');
  const parsedParty = aiParsedParty !== null ? aiParsedParty : (nlpResult.party || (parties.length > 0 ? parties[0].name : 'General Customer'));
  const parsedCategory = aiParsedCategory !== null ? aiParsedCategory : nlpResult.category;
  const confidenceScore = nlpResult.confidence;

  // Core Gemini AI Text Parsing Trigger
  const runGeminiTextParser = async (textToParse) => {
    if (!textToParse || !textToParse.trim()) return;
    setIsAiParsing(true);
    setAiStatusMsg('🤖 Gemini AI analyzing spoken text prompt...');

    try {
      const result = await parseNaturalLanguagePrompt(textToParse, parties);
      if (result) {
        if (result.amount) setAiParsedAmount(String(result.amount));
        if (result.partyName) setAiParsedParty(result.partyName);
        if (result.category) setAiParsedCategory(result.category);
        if (result.type) setSelectedType(result.type === 'GOT' ? 'CREDIT' : 'DEBIT');
        if (result.paymentMode) setPaymentMode(result.paymentMode.toUpperCase());
        setAiStatusMsg('✅ Gemini AI parsed transaction details with high accuracy!');
      } else {
        setAiStatusMsg('⚡ NLP Parser active (Confidence: ' + confidenceScore + ')');
      }
    } catch (err) {
      console.warn('Gemini text parser notice:', err);
      setAiStatusMsg('⚡ NLP Parser active (Confidence: ' + confidenceScore + ')');
    } finally {
      setIsAiParsing(false);
    }
  };

  // Stop whatever mic path is active. `discard` skips transcription of
  // whatever was captured so far — used when the modal closes/unmounts, as
  // opposed to the user deliberately tapping the mic to finish.
  const cleanupMic = (discard = true) => {
    discardOnStopRef.current = discard;

    if (recognitionRef.current) {
      try {
        discard ? recognitionRef.current.abort() : recognitionRef.current.stop();
      } catch {
        // Recognition may already be stopped/aborted — nothing to clean up.
      }
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Recorder may already be inactive.
      }
    } else if (discard && mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;

    if (discard) setMicStatus('idle');
  };
  cleanupMicRef.current = () => cleanupMic(true);

  // Path 1: native Web Speech API — streams interim results live into the
  // textarea. Not available in the Android WebView this app ships in, so
  // this only actually runs in a full browser (e.g. desktop Chrome dev).
  const startWebSpeech = (SpeechRecognitionCtor) => {
    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = speechLang;
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setMicStatus('listening');
        setMicError('');
      };

      recognition.onresult = (event) => {
        let interimText = '';
        let finalText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) finalText += transcript;
          else interimText += transcript;
        }

        if (finalText) {
          setPromptText(finalText);
          setMicStatus('processing');
          runGeminiTextParser(finalText).finally(() => {
            setMicStatus((s) => (s === 'processing' ? 'idle' : s));
          });
        } else if (interimText) {
          setPromptText(interimText);
        }
      };

      recognition.onerror = (event) => {
        if (event.error === 'aborted') {
          setMicStatus('idle');
          return;
        }
        setMicError(SPEECH_ERROR_MESSAGES[event.error] || `Voice input error (${event.error}). Please try again or type your entry.`);
        setMicStatus('error');
      };

      recognition.onend = () => {
        recognitionRef.current = null;
        setMicStatus((s) => (s === 'listening' ? 'idle' : s));
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setMicError('Could not start voice input. Please try again or type your entry.');
      setMicStatus('error');
    }
  };

  // Path 2: record with MediaRecorder and transcribe via Gemini. This is the
  // path that actually runs on the shipped Android app, since the WebView
  // there has no SpeechRecognition global at all.
  const startMediaRecorderFallback = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder === 'undefined') {
      setMicError('Voice input is not supported on this device. Please type your entry instead.');
      setMicStatus('error');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      discardOnStopRef.current = false;

      const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
      const mimeType = preferredTypes.find((t) => window.MediaRecorder.isTypeSupported?.(t)) || '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onerror = (e) => {
        console.error('MediaRecorder error:', e.error);
        setMicError('Recording failed. Please try again.');
        setMicStatus('error');
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];

        if (discardOnStopRef.current) return; // modal closed mid-recording

        const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
        if (blob.size < 800) {
          setMicError('No speech detected. Tap the mic and try speaking again.');
          setMicStatus('error');
          return;
        }

        setMicStatus('processing');
        try {
          const transcript = await transcribeAudio(blob, speechLang);
          if (!transcript) {
            setMicError('Could not understand the recording. Please try again or type your entry.');
            setMicStatus('error');
            return;
          }
          setPromptText(transcript);
          await runGeminiTextParser(transcript);
          setMicStatus('idle');
        } catch (err) {
          console.warn('Voice transcription failed:', err);
          setMicError(
            err?.isOffline
              ? 'Voice transcription needs an internet connection. Check your network and try again.'
              : 'Voice transcription failed. Please try again or type your entry.'
          );
          setMicStatus('error');
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setMicStatus('listening');
      setMicError('');
    } catch (err) {
      console.warn('Microphone permission notice:', err);
      if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
        setMicError('Microphone access was denied. Enable the microphone for this app in your phone Settings → Apps → Khata.Pro → Permissions, then try again.');
      } else if (err.name === 'NotFoundError') {
        setMicError('No microphone was found on this device.');
      } else {
        setMicError('Could not access the microphone. Please try again or type your entry.');
      }
      setMicStatus('error');
    }
  };

  const handleMicTap = () => {
    if (micStatus === 'listening') {
      cleanupMic(false); // user tap-to-stop: finalize and transcribe
      return;
    }
    if (micStatus === 'processing') return; // already transcribing, ignore
    setMicError('');

    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setMicError('Voice input requires a secure connection (HTTPS). Please type your entry instead.');
      setMicStatus('error');
      return;
    }

    const SpeechRecognitionCtor = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
    if (SpeechRecognitionCtor) {
      startWebSpeech(SpeechRecognitionCtor);
    } else {
      startMediaRecorderFallback();
    }
  };

  const handleQuickAddAmount = (val) => {
    const currentNum = parseInt(parsedAmount) || 0;
    const num = currentNum + val;
    const newText = `Paid ₹${num} to ${parsedParty}`;
    setPromptText(newText);
    setAiParsedAmount(String(num));
  };

  const handleReset = () => {
    setPromptText('');
    setAiParsedAmount(null);
    setAiParsedParty(null);
    setAiParsedCategory(null);
    setAiStatusMsg('');
    setMicStatus('idle');
    setMicError('');
  };

  const handleSave = async () => {
    if (!parsedAmount || parsedAmount === '0') {
      alert('Please describe an amount in your prompt or click a quick pad button.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addTransaction(currentWorkspace?.id || 'ws_local_default', {
        partyName: parsedParty,
        type: (selectedType === 'DEBIT' || nlpResult.type === 'GAVE') ? 'GAVE' : 'GOT',
        amount: Number(parsedAmount),
        paymentMode,
        category: parsedCategory,
        notes: promptText || `Smart entry transaction for ${parsedParty}`
      });
      onClose();
      handleReset();
    } catch (err) {
      alert(`Failed to save: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(9, 13, 22, 0.85)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1200,
      padding: '1rem'
    }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '520px', padding: '1.75rem', borderRadius: '24px' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #4F46E5, #818CF8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Sparkles size={20} color="#FFF" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>Smart Natural Language Entry</h3>
              <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)', margin: 0, marginTop: '0.15rem' }}>Gemini AI & NLP Rule-Based Tokenizer</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            style={{ background: 'var(--bg-canvas)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Input Text Box with Mic Button */}
        <div style={{ position: 'relative', marginBottom: '0.6rem' }}>
          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            onBlur={() => runGeminiTextParser(promptText)}
            placeholder="Type or speak e.g. 'Spent ₹450 on dinner with Ram' or 'Got 1200 salary from Shyam'..."
            rows={3}
            style={{
              width: '100%',
              background: 'var(--bg-canvas)',
              border: '1.5px solid var(--border-color)',
              borderRadius: '16px',
              padding: '1rem 4rem 1rem 1rem',
              color: 'var(--text-main)',
              fontSize: '0.95rem',
              resize: 'none',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />

          <button
            onClick={handleMicTap}
            disabled={micStatus === 'processing'}
            title={isListening ? 'Tap to stop' : 'Tap to speak'}
            style={{
              position: 'absolute',
              right: '12px',
              top: '12px',
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: isListening ? 'var(--color-rose)' : micStatus === 'error' ? 'var(--color-amber, #F59E0B)' : 'var(--color-purple)',
              border: 'none',
              color: '#FFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: micStatus === 'processing' ? 'default' : 'pointer',
              opacity: micStatus === 'processing' ? 0.7 : 1,
              boxShadow: isListening ? '0 0 16px rgba(244, 63, 94, 0.6)' : '0 4px 12px rgba(99, 102, 241, 0.3)',
              transition: 'all 0.2s ease'
            }}
          >
            {micStatus === 'processing' ? (
              <Loader2 size={20} className="spin" />
            ) : (
              <Mic size={20} className={isListening ? 'mic-pulse' : ''} />
            )}
          </button>
        </div>

        {/* Mic Status Row: listening / processing / error */}
        {micStatus !== 'idle' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.8rem',
            fontWeight: '600',
            padding: '0.55rem 0.8rem',
            borderRadius: '10px',
            marginBottom: '1rem',
            background: micStatus === 'error' ? 'rgba(244, 63, 94, 0.1)' : 'rgba(99, 102, 241, 0.1)',
            color: micStatus === 'error' ? 'var(--color-rose)' : 'var(--color-purple-40)'
          }}>
            {micStatus === 'listening' && <><Mic size={14} className="mic-pulse" /> Listening… speak your transaction.</>}
            {micStatus === 'processing' && <><Loader2 size={14} className="spin" /> Transcribing your voice note…</>}
            {micStatus === 'error' && <><AlertTriangle size={14} /> {micError}</>}
          </div>
        )}

        {/* NLP Confidence Score Badge */}
        {promptText && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-canvas)',
            padding: '0.6rem 0.9rem',
            borderRadius: '12px',
            marginBottom: '1rem',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <Zap size={14} color="var(--color-purple)" />
              <span>NLP Parser Confidence:</span>
            </div>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: '800',
              padding: '0.2rem 0.6rem',
              borderRadius: '20px',
              background: confidenceScore === 'HIGH' ? 'rgba(16, 185, 129, 0.15)' : confidenceScore === 'MEDIUM' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: confidenceScore === 'HIGH' ? '#10B981' : confidenceScore === 'MEDIUM' ? '#F59E0B' : '#EF4444'
            }}>
              {confidenceScore} CONFIDENCE
            </span>
          </div>
        )}

        {/* Realtime Parsed Details Preview Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
          
          <div style={{ background: 'var(--bg-canvas)', padding: '0.85rem', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
              <DollarSign size={14} /> Amount
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--color-emerald)' }}>
              ₹{parsedAmount}
            </div>
          </div>

          <div style={{ background: 'var(--bg-canvas)', padding: '0.85rem', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
              <User size={14} /> Party
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {parsedParty}
            </div>
          </div>

          <div style={{ background: 'var(--bg-canvas)', padding: '0.85rem', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
              <Tag size={14} /> Category
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {parsedCategory}
            </div>
          </div>

        </div>

        {/* Quick Amount Pad */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {[100, 500, 1000, 5000].map((amt) => (
            <button
              key={amt}
              onClick={() => handleQuickAddAmount(amt)}
              style={{
                flex: 1,
                padding: '0.5rem',
                borderRadius: '10px',
                background: 'var(--bg-canvas)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                fontSize: '0.8rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              +₹{amt}
            </button>
          ))}
        </div>

        {/* Submit & Reset Controls */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={handleReset}
            style={{
              padding: '0.85rem 1.2rem',
              borderRadius: '14px',
              background: 'var(--bg-canvas)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-muted)',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Reset
          </button>
          
          <button
            onClick={handleSave}
            disabled={isSubmitting}
            style={{
              flex: 1,
              padding: '0.85rem',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, var(--color-purple), #4F46E5)',
              border: 'none',
              color: '#FFF',
              fontWeight: '800',
              fontSize: '0.95rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            {isSubmitting ? <Loader2 size={18} className="spin" /> : <CheckCircle2 size={18} />}
            Confirm & Save Entry
          </button>
        </div>

      </div>
    </div>
  );
}
