/**
 * features/proctor/AudioMonitor.tsx
 *
 * Three jobs, running off the same mic stream:
 *
 *  1. Existing dB sampling every `checkIntervalMs` — unchanged behavior,
 *     cheap noise-level logging, no cost, no server needed.
 *
 *  2. Free, in-browser Voice Activity Detection (VAD). A short high-rate
 *     energy buffer (checked every 200ms) distinguishes *sustained* speech
 *     from a one-off bang/cough/chair-scrape. When speech looks real it
 *     records a short clip (MediaRecorder, native browser API, no extra
 *     dependency) and uploads it to Storage — purely so a proctor can
 *     listen to it later, after the exam, from Flagged Attempts.
 *
 *  3. NEW — transcription is done for FREE, entirely client-side, via the
 *     browser's built-in Web Speech API (SpeechRecognition). No API key,
 *     no per-minute billing, nothing sent to a paid transcription service.
 *     We run it continuously while sustained speech is detected and grab
 *     whatever text it produced for that window. The transcript TEXT
 *     (never the audio) is sent to the backend, which only does a free,
 *     deterministic fuzzy-match against the exam's own questions — no LLM
 *     call either.
 *
 *     Browser support: Chrome/Edge (SpeechRecognition via webkit prefix).
 *     Not supported in Firefox/Safari — on those browsers this feature
 *     just quietly does nothing (dB noise logging + clip capture for
 *     post-exam playback still work fine, there's just no live "flagged
 *     wording" text). We deliberately do NOT fall back to a paid cloud
 *     transcription API, so this pipeline costs $0 no matter what.
 */
import { useEffect, useRef } from "react";
import { post } from "../../lib/api";
import { supabase } from "../../lib/supabase";

interface AudioMonitorProps {
  attemptId: string;
  noiseTreshold?: number;
  checkIntervalMs?: number;
}

const NOISE_THRESHOLD     = 60;    // dB — "loud noise" logging threshold (unchanged)
const SPEECH_DB_THRESHOLD = 52;    // dB — much quieter than "loud noise"; normal talking level
const CHECK_INTERVAL      = 10_000;
const LOG_QUIET_EVERY     = 6;
const FFT_SIZE            = 2048;
const VAD_WINDOW_MS       = 1_500; // how long a sustained energy run must last
const VAD_SUBSAMPLE_MS    = 200;   // resolution of the sustained-energy check
const VAD_HIT_RATIO       = 0.7;   // fraction of sub-samples that must clear SPEECH_DB_THRESHOLD
const CLIP_DURATION_MS    = 6_000; // length of the recorded clip once speech is confirmed
const CLIP_COOLDOWN_MS    = 20_000; // don't fire another clip within this window of the last one

const AUDIO_BUCKET = "exam-audio-clips";

// Minimal typing for the (non-standard, vendor-prefixed) Web Speech API —
// not in lib.dom.d.ts, so we declare just what we use.
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: { transcript: string };
}
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onend: (() => void) | null;
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => SpeechRecognitionLike) | null ?? null;
}

export default function AudioMonitor({
  attemptId,
  noiseTreshold = NOISE_THRESHOLD,
  checkIntervalMs = CHECK_INTERVAL,
}: AudioMonitorProps) {
  const streamRef       = useRef<MediaStream | null>(null);
  const ctxRef          = useRef<AudioContext | null>(null);
  const analyserRef     = useRef<AnalyserNode | null>(null);
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const vadTimerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkCount      = useRef(0);
  const activeRef       = useRef(true);
  const vadHistoryRef   = useRef<number[]>([]); // rolling dB samples for VAD
  const recordingRef    = useRef(false);
  const lastClipAtRef   = useRef(0);
  const recognitionRef  = useRef<SpeechRecognitionLike | null>(null);
  const liveTranscriptRef = useRef("");   // accumulates text while a clip window is open
  const recognizingRef  = useRef(false);

  const currentDb = (): number => {
    if (!analyserRef.current) return 0;
    const buffer = new Float32Array(analyserRef.current.fftSize);
    analyserRef.current.getFloatTimeDomainData(buffer);
    const rms = Math.sqrt(buffer.reduce((s, v) => s + v * v, 0) / buffer.length);
    const db  = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
    return Math.round(Math.max(0, db + 100));
  };

  useEffect(() => {
    activeRef.current = true;
    console.log("[AudioMonitor] Mounting — attemptId:", attemptId, "threshold:", noiseTreshold, "dB");

    // ── Free, in-browser transcription (SpeechRecognition) ─────────────────
    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor) {
      console.warn("[AudioMonitor] SpeechRecognition not supported in this browser — live transcription disabled (dB noise logging + post-exam clip playback still work).");
    } else {
      try {
        const recognition = new SpeechRecognitionCtor();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";
        recognition.onresult = (ev) => {
          let finalText = "";
          for (let i = ev.resultIndex; i < ev.results.length; i++) {
            const r = ev.results[i];
            if (r.isFinal) finalText += r[0].transcript + " ";
          }
          if (finalText.trim()) {
            liveTranscriptRef.current = (liveTranscriptRef.current + " " + finalText).trim();
          }
        };
        recognition.onerror = (ev) => {
          console.warn("[AudioMonitor] SpeechRecognition error:", (ev as unknown as { error?: string }).error);
        };
        recognition.onend = () => {
          recognizingRef.current = false;
          // Keep it running for the whole exam — auto-restart unless we've unmounted.
          if (activeRef.current) {
            try { recognition.start(); recognizingRef.current = true; } catch { /* already starting */ }
          }
        };
        recognition.start();
        recognizingRef.current = true;
        recognitionRef.current = recognition;
        console.log("[AudioMonitor] ✓ Free browser SpeechRecognition started — no API key, no cost");
      } catch (err) {
        console.warn("[AudioMonitor] Could not start SpeechRecognition:", err);
      }
    }

    // ── Job 1: existing dB sampling (unchanged) ─────────────────────────────
    const sample = async () => {
      if (!activeRef.current || !analyserRef.current) {
        console.warn("[AudioMonitor] sample() skipped — analyser not ready yet");
        return;
      }
      const dbDisplay = currentDb();
      checkCount.current += 1;
      const noiseDetected = dbDisplay >= noiseTreshold;
      console.log(`[AudioMonitor] Sample #${checkCount.current} — ${dbDisplay} dB — noise: ${noiseDetected}`);
      if (noiseDetected || checkCount.current % LOG_QUIET_EVERY === 0) {
        try {
          await post("/api/v1/proctoring/audio", {
            attempt_id:     attemptId,
            noise_detected: noiseDetected,
            noise_level_db: dbDisplay,
            notes: noiseDetected
              ? dbDisplay >= 80 ? "Loud noise detected" : "Moderate noise"
              : "Quiet — audit log",
          });
          console.log("[AudioMonitor] ✓ Posted — noise:", noiseDetected, dbDisplay + "dB");
        } catch (err) {
          console.warn("[AudioMonitor] ❌ POST failed:", err);
        }
      }
    };

    // ── Job 2 + 3: VAD-gated clip capture (for later playback) + free
    //    client-side transcript (for live exam-relevance flagging) ─────────
    const recordAndSendClip = () => {
      if (!streamRef.current || recordingRef.current) return;
      const now = Date.now();
      if (now - lastClipAtRef.current < CLIP_COOLDOWN_MS) return;

      recordingRef.current = true;
      lastClipAtRef.current = now;
      liveTranscriptRef.current = ""; // start a fresh transcript window for this clip
      console.log("[AudioMonitor] 🎙 Sustained speech detected — recording", CLIP_DURATION_MS / 1000, "s clip");

      const chunks: BlobPart[] = [];
      let recorder: MediaRecorder;
      // audio/webm isn't supported everywhere (notably Safari) — probe for a
      // mimeType the browser actually supports instead of hardcoding one,
      // otherwise the recorder throws immediately and no clip is ever made.
      const candidateTypes = ["audio/webm", "audio/webm;codecs=opus", "audio/mp4", "audio/ogg"];
      const mimeType = candidateTypes.find((t) => MediaRecorder.isTypeSupported?.(t)) ?? "";
      try {
        recorder = mimeType
          ? new MediaRecorder(streamRef.current, { mimeType })
          : new MediaRecorder(streamRef.current);
      } catch (err) {
        console.warn("[AudioMonitor] MediaRecorder unavailable:", err);
        recordingRef.current = false;
        return;
      }

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = async () => {
        recordingRef.current = false;
        if (!activeRef.current) return;

        const usedType = recorder.mimeType || "audio/webm";
        const ext = usedType.includes("mp4") ? "m4a" : usedType.includes("ogg") ? "ogg" : "webm";
        const blob = new Blob(chunks, { type: usedType });
        const path = `${attemptId}/${Date.now()}.${ext}`;
        // Snapshot whatever SpeechRecognition transcribed during this window —
        // free, client-side, done by the time the clip finishes recording.
        const transcript = liveTranscriptRef.current.trim() || null;

        try {
          const { error } = await supabase.storage
            .from(AUDIO_BUCKET)
            .upload(path, blob, { contentType: usedType, upsert: true });
          if (error) {
            console.warn("[AudioMonitor] ❌ Clip upload failed (does the '" + AUDIO_BUCKET + "' bucket exist?):", error.message);
            // Even if the clip upload fails, still send the free transcript
            // so exam-relevance flagging isn't blocked by a Storage issue.
          }
          const audioUrl = error
            ? null
            : supabase.storage.from(AUDIO_BUCKET).getPublicUrl(path).data.publicUrl;

          console.log("[AudioMonitor] ✓ Sending free browser transcript:", transcript ?? "(none captured)");
          await post("/api/v1/proctoring/audio-transcript", {
            attempt_id: attemptId,
            audio_url:  audioUrl,
            transcript, // ← free, browser-transcribed text; backend skips any paid API when this is present
          });
        } catch (err) {
          console.warn("[AudioMonitor] Transcript request failed:", err);
        }
      };

      recorder.start();
      setTimeout(() => { if (recorder.state !== "inactive") recorder.stop(); }, CLIP_DURATION_MS);
    };

    const vadTick = () => {
      if (!activeRef.current || !analyserRef.current) return;
      const db = currentDb();
      vadHistoryRef.current.push(db);
      const maxSamples = Math.ceil(VAD_WINDOW_MS / VAD_SUBSAMPLE_MS);
      if (vadHistoryRef.current.length > maxSamples) vadHistoryRef.current.shift();

      if (vadHistoryRef.current.length === maxSamples) {
        const hits = vadHistoryRef.current.filter((v) => v >= SPEECH_DB_THRESHOLD).length;
        const ratio = hits / maxSamples;
        // Sustained speech-level energy across the whole window — not a
        // single spike (a bang/cough would only hit 1-2 samples, not ~60%+
        // of a continuous 1.2s window).
        if (ratio >= VAD_HIT_RATIO) {
          recordAndSendClip();
          vadHistoryRef.current = []; // reset so we don't immediately re-trigger
        }
      }
    };

    const start = async () => {
      try {
        console.log("[AudioMonitor] Requesting mic...");
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
          video: false,
        });
        if (!activeRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = FFT_SIZE;
        ctx.createMediaStreamSource(stream).connect(analyser);
        ctxRef.current = ctx;
        analyserRef.current = analyser;
        console.log("[AudioMonitor] ✓ Mic ready — first sample in 5s");

        setTimeout(() => void sample(), 5_000);
        timerRef.current = setInterval(() => void sample(), checkIntervalMs);
        vadTimerRef.current = setInterval(vadTick, VAD_SUBSAMPLE_MS);
      } catch (err) {
        console.warn("[AudioMonitor] ❌ Mic error:", (err as Error).message);
      }
    };

    void start();

    return () => {
      activeRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (vadTimerRef.current) clearInterval(vadTimerRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      void ctxRef.current?.close();
      try { recognitionRef.current?.stop(); } catch { /* no-op */ }
      recognitionRef.current = null;
      console.log("[AudioMonitor] Unmounted");
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  return null;
}