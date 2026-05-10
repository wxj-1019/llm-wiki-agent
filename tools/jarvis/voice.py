#!/usr/bin/env python3
from __future__ import annotations

import asyncio
import os
import platform
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent

try:
    import edge_tts
except ImportError:
    edge_tts = None

try:
    import pyttsx3
except ImportError:
    pyttsx3 = None

try:
    import speech_recognition as sr
except ImportError:
    sr = None

try:
    import whisper
except ImportError:
    whisper = None

try:
    import pygame
except ImportError:
    pygame = None

try:
    from playsound import playsound as _playsound
except ImportError:
    _playsound = None


class VoiceInterface:
    def __init__(self):
        self._tts_engines = self._check_tts()
        self._stt_engines = self._check_stt()
        self._microphone_available = self._check_microphone()

    def _check_tts(self) -> list[str]:
        engines: list[str] = []
        if edge_tts is not None:
            engines.append("edge_tts")
        if pyttsx3 is not None:
            engines.append("pyttsx3")
        system = platform.system()
        if system == "Darwin":
            try:
                result = subprocess.run(
                    ["which", "say"], capture_output=True, timeout=3
                )
                if result.returncode == 0:
                    engines.append("say")
            except Exception:
                pass
        elif system == "Linux":
            try:
                result = subprocess.run(
                    ["which", "espeak"], capture_output=True, timeout=3
                )
                if result.returncode == 0:
                    engines.append("espeak")
            except Exception:
                pass
        return engines

    def _check_stt(self) -> list[str]:
        engines: list[str] = []
        if sr is not None:
            engines.append("speech_recognition")
        if whisper is not None:
            engines.append("whisper")
        return engines

    def _check_microphone(self) -> bool:
        if sr is None:
            return False
        try:
            mic = sr.Microphone()
            with mic as source:
                pass
            return True
        except Exception:
            return False

    def text_to_speech(self, text: str, output_path: str = "") -> dict:
        if not output_path:
            state_dir = REPO_ROOT / "state"
            state_dir.mkdir(parents=True, exist_ok=True)
            output_path = str(state_dir / "jarvis_tts_output.mp3")

        if edge_tts is not None:
            try:
                communicate = edge_tts.Communicate(text)
                if sys.platform == "win32":
                    loop = asyncio.new_event_loop()
                    try:
                        loop.run_until_complete(communic.save(output_path))
                    finally:
                        loop.close()
                else:
                    asyncio.run(communicate.save(output_path))
                return {
                    "success": True,
                    "path": output_path,
                    "engine": "edge_tts",
                    "duration_estimate": len(text) * 0.06,
                }
            except Exception as exc:
                last_error = str(exc)

        if pyttsx3 is not None:
            try:
                engine = pyttsx3.init()
                if not output_path.endswith(".mp3"):
                    wav_path = output_path.rsplit(".", 1)[0] + ".wav"
                else:
                    wav_path = output_path.rsplit(".", 1)[0] + ".wav"
                engine.save_to_file(text, wav_path)
                engine.runAndWait()
                return {
                    "success": True,
                    "path": wav_path,
                    "engine": "pyttsx3",
                    "duration_estimate": len(text) * 0.06,
                }
            except Exception as exc:
                last_error = str(exc)

        system = platform.system()
        if system == "Darwin":
            try:
                subprocess.run(["say", text], timeout=30)
                return {
                    "success": True,
                    "path": "",
                    "engine": "say",
                    "duration_estimate": len(text) * 0.06,
                }
            except Exception as exc:
                last_error = str(exc)
        elif system == "Linux":
            try:
                subprocess.run(["espeak", text], timeout=30)
                return {
                    "success": True,
                    "path": "",
                    "engine": "espeak",
                    "duration_estimate": len(text) * 0.06,
                }
            except Exception as exc:
                last_error = str(exc)

        return {"success": False, "error": getattr(locals(), "last_error", "No TTS engine available")}

    def speech_to_text(self, audio_path: str, language: str = "en") -> dict:
        if sr is not None:
            try:
                recognizer = sr.Recognizer()
                with sr.AudioFile(audio_path) as source:
                    audio_data = recognizer.record(source)
                transcript = recognizer.recognize_google(audio_data, language=language)
                return {
                    "success": True,
                    "text": transcript,
                    "confidence": 0.0,
                    "engine": "speech_recognition",
                }
            except sr.UnknownValueError:
                return {"success": False, "error": "Speech not understood"}
            except sr.RequestError as exc:
                last_error = str(exc)
            except Exception as exc:
                last_error = str(exc)

        if whisper is not None:
            try:
                model = whisper.load_model("base")
                result = model.transcribe(audio_path, language=language)
                return {
                    "success": True,
                    "text": result.get("text", ""),
                    "confidence": 0.0,
                    "engine": "whisper",
                }
            except Exception as exc:
                last_error = str(exc)

        return {"success": False, "error": getattr(locals(), "last_error", "No STT engine available")}

    def listen_and_transcribe(self, timeout: int = 5) -> dict:
        if sr is None:
            return {"success": False, "error": "No STT engine available"}
        if not self._microphone_available:
            return {"success": False, "error": "No microphone available"}
        try:
            recognizer = sr.Recognizer()
            with sr.Microphone() as source:
                recognizer.adjust_for_ambient_noise(source, duration=0.5)
                audio_data = recognizer.listen(source, timeout=timeout, phrase_time_limit=timeout)
            transcript = recognizer.recognize_google(audio_data)
            return {"success": True, "text": transcript, "engine": "speech_recognition"}
        except sr.WaitTimeoutError:
            return {"success": False, "error": "Listening timed out"}
        except sr.UnknownValueError:
            return {"success": False, "error": "Speech not understood"}
        except Exception as exc:
            return {"success": False, "error": str(exc)}

    def speak(self, text: str) -> dict:
        tts_result = self.text_to_speech(text)
        if not tts_result.get("success"):
            return tts_result

        output_path = tts_result.get("path", "")
        if not output_path or not os.path.isfile(output_path):
            return tts_result

        if pygame is not None:
            try:
                pygame.mixer.init()
                pygame.mixer.music.load(output_path)
                pygame.mixer.music.play()
                while pygame.mixer.music.get_busy():
                    pygame.time.Clock().tick(10)
                pygame.mixer.quit()
                tts_result["played"] = True
                tts_result["play_engine"] = "pygame"
                return tts_result
            except Exception:
                pass

        if _playsound is not None:
            try:
                _playsound(output_path)
                tts_result["played"] = True
                tts_result["play_engine"] = "playsound"
                return tts_result
            except Exception:
                pass

        system = platform.system()
        if system == "Windows":
            try:
                os.startfile(output_path)
                tts_result["played"] = True
                tts_result["play_engine"] = "system_default"
                return tts_result
            except Exception:
                pass
        elif system == "Darwin":
            try:
                subprocess.run(["afplay", output_path], timeout=60)
                tts_result["played"] = True
                tts_result["play_engine"] = "afplay"
                return tts_result
            except Exception:
                pass
        elif system == "Linux":
            for cmd in ["aplay", "paplay", "mpg123", "ffplay"]:
                try:
                    subprocess.run([cmd, output_path], timeout=60)
                    tts_result["played"] = True
                    tts_result["play_engine"] = cmd
                    return tts_result
                except Exception:
                    continue

        tts_result["played"] = False
        tts_result["play_error"] = "No audio playback engine available"
        return tts_result

    def get_capabilities(self) -> dict:
        return {
            "tts": self._tts_engines,
            "stt": self._stt_engines,
            "microphone": self._microphone_available,
        }


_voice_instance: VoiceInterface | None = None


def get_voice() -> VoiceInterface:
    global _voice_instance
    if _voice_instance is None:
        _voice_instance = VoiceInterface()
    return _voice_instance
