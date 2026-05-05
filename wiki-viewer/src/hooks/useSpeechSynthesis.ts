import { useState, useEffect, useCallback, useRef } from 'react';

interface UseSpeechSynthesisReturn {
  playing: boolean;
  paused: boolean;
  rate: number;
  voice: SpeechSynthesisVoice | null;
  voices: SpeechSynthesisVoice[];
  play: () => void;
  pause: () => void;
  stop: () => void;
  setRate: (rate: number) => void;
  setVoice: (voice: SpeechSynthesisVoice | null) => void;
}

export function useSpeechSynthesis(text: string): UseSpeechSynthesisReturn {
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [rate, setRateState] = useState(1);
  const [voice, setVoiceState] = useState<SpeechSynthesisVoice | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const rateRef = useRef(rate);
  const voiceRef = useRef(voice);

  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);

  useEffect(() => {
    voiceRef.current = voice;
  }, [voice]);

  useEffect(() => {
    const synth = window.speechSynthesis;

    const loadVoices = () => {
      const available = synth.getVoices();
      setVoices(available);
      if (!voiceRef.current && available.length > 0) {
        const defaultVoice = available.find((v) => v.default) || available[0];
        setVoiceState(defaultVoice);
      }
    };

    loadVoices();
    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = loadVoices;
    }

    return () => {
      synth.cancel();
      synth.onvoiceschanged = null;
    };
  }, []);

  const play = useCallback(() => {
    const synth = window.speechSynthesis;

    if (paused && utteranceRef.current) {
      synth.resume();
      setPlaying(true);
      setPaused(false);
      return;
    }

    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rateRef.current;
    if (voiceRef.current) {
      utterance.voice = voiceRef.current;
    }

    utterance.onend = () => {
      setPlaying(false);
      setPaused(false);
      utteranceRef.current = null;
    };

    utterance.onerror = (event) => {
      if (event.error !== 'canceled') {
        setPlaying(false);
        setPaused(false);
        utteranceRef.current = null;
      }
    };

    utterance.onpause = () => {
      setPlaying(false);
      setPaused(true);
    };

    utteranceRef.current = utterance;
    synth.speak(utterance);
    setPlaying(true);
    setPaused(false);
  }, [text, paused]);

  const pause = useCallback(() => {
    window.speechSynthesis.pause();
    setPlaying(false);
    setPaused(true);
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setPlaying(false);
    setPaused(false);
    utteranceRef.current = null;
  }, []);

  const setRate = useCallback(
    (newRate: number) => {
      setRateState(newRate);
      // Restart if currently playing to apply new rate immediately
      if (playing) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = newRate;
        if (voiceRef.current) {
          utterance.voice = voiceRef.current;
        }
        utterance.onend = () => {
          setPlaying(false);
          setPaused(false);
          utteranceRef.current = null;
        };
        utterance.onerror = (event) => {
          if (event.error !== 'canceled') {
            setPlaying(false);
            setPaused(false);
            utteranceRef.current = null;
          }
        };
        utterance.onpause = () => {
          setPlaying(false);
          setPaused(true);
        };
        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      }
    },
    [text, playing]
  );

  const setVoice = useCallback((newVoice: SpeechSynthesisVoice | null) => {
    setVoiceState(newVoice);
  }, []);

  return {
    playing,
    paused,
    rate,
    voice,
    voices,
    play,
    pause,
    stop,
    setRate,
    setVoice,
  };
}
