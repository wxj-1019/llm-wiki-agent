import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpeechSynthesis } from './useSpeechSynthesis';

describe('useSpeechSynthesis', () => {
  const mockSpeak = vi.fn();
  const mockCancel = vi.fn();
  const mockPause = vi.fn();
  const mockResume = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.speechSynthesis = {
      speak: mockSpeak,
      cancel: mockCancel,
      pause: mockPause,
      resume: mockResume,
      getVoices: vi.fn().mockReturnValue([
        { name: 'Voice 1', lang: 'en-US' } as SpeechSynthesisVoice,
        { name: 'Voice 2', lang: 'zh-CN' } as SpeechSynthesisVoice,
      ]),
      onvoiceschanged: null,
    } as unknown as SpeechSynthesis;
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => useSpeechSynthesis(''));
    expect(result.current.playing).toBe(false);
    expect(result.current.rate).toBe(1);
    expect(result.current.voices).toHaveLength(2);
  });

  it('starts playing', () => {
    const { result } = renderHook(() => useSpeechSynthesis('Hello world'));
    act(() => {
      result.current.play();
    });
    expect(result.current.playing).toBe(true);
    expect(mockSpeak).toHaveBeenCalledOnce();
  });

  it('stops playing', () => {
    const { result } = renderHook(() => useSpeechSynthesis('Hello'));
    act(() => {
      result.current.play();
      result.current.stop();
    });
    expect(result.current.playing).toBe(false);
    expect(mockCancel).toHaveBeenCalledTimes(2); // play() calls cancel, stop() calls cancel again
  });

  it('changes rate', () => {
    const { result } = renderHook(() => useSpeechSynthesis(''));
    act(() => {
      result.current.setRate(1.5);
    });
    expect(result.current.rate).toBe(1.5);
  });
});
