/**
 * features/proctor/AudioMonitor.tsx
 *
 * Two jobs, running off the same mic stream:
 *
 *  1. Existing dB sampling every `checkIntervalMs` — unchanged behavior,
 *     cheap noise-level logging, no cost, no server needed.
 *
 *  2. NEW — free, in-browser Voice Activity Detection (VAD). A short
 *     high-rate energy buffer (checked every 200ms) distinguishes
 *     *sustained* speech from a one-off bang/cough/chair-scrape. Only when
 *     speech looks real does it record a short clip (MediaRecorder, native
 *     browser API, no extra dependency) and upload it for transcription —
 *     everything else never leaves the browser as audio.
 *
 * The transcription + "are they talking about the exam" step happens on
 * the backend at POST /api/v1/proctoring/audio-transcript — NOT YET ADDED
 * to proctoring.py in this project. This file will silently no-op that
 * part (the POST will just 404) until that endpoint exists — the existing
 * dB-based noise logging is unaffected either way.
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
const SPEECH_DB_THRESHOLD = 42;    // dB — much quieter than "loud noise"; normal talking level
const CHECK_INTERVAL      = 10_000;
const LOG_QUIET_EVERY     = 6;
const FFT_SIZE            = 2048;

const VAD_WINDOW_MS       = 1_200; // how long a sustained energy run must last
const VAD_SUBSAMPLE_MS    = 200;   // resolution of the sustained-energy check
const VAD_HIT_RATIO       = 0.6;   // fraction of sub-samples that must clear SPEECH_DB_THRESHOLD
const CLIP_DURATION_MS    = 6_000; // length of the recorded clip once speech is confirmed
const CLIP_COOLDOWN_MS    = 20_000; // don't fire another clip within this window of the last one

const AUDIO_BUCKET = "exam-audio-clips"; // NOTE: create this Storage bucket before enabling — see comment below

export default function AudioMonitor({
  attemptId,
  noiseTreshold = NOISE_THRESHOLD,
  checkIntervalMs = CHECK_INTERVAL,
}: AudioMonitorProps) {
  const streamRef     = useRef<MediaStream | null>(null);
  const ctxRef        = useRef<AudioContext | null>(null);
  const analyserRef   = useRef<AnalyserNode | null>(null);
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const vadTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkCount    = useRef(0);
  const activeRef     = useRef(true);
  const vadHistoryRef = useRef<number[]>([]); // rolling dB samples for VAD
  const recordingRef  = useRef(false);
  const lastClipAtRef = useRef(0);

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

    // ── Job 2: VAD-gated clip capture + transcription request ──────────────
    const recordAndSendClip = () => {
      if (!streamRef.current || recordingRef.current) return;
      const now = Date.now();
      if (now - lastClipAtRef.current < CLIP_COOLDOWN_MS) return;

      recordingRef.current = true;
      lastClipAtRef.current = now;
      console.log("[AudioMonitor] 🎙 Sustained speech detected — recording", CLIP_DURATION_MS / 1000, "s clip");

      const chunks: BlobPart[] = [];
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(streamRef.current, { mimeType: "audio/webm" });
      } catch (err) {
        console.warn("[AudioMonitor] MediaRecorder unavailable:", err);
        recordingRef.current = false;
        return;
      }

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = async () => {
        recordingRef.current = false;
        if (!activeRef.current) return;
        const blob = new Blob(chunks, { type: "audio/webm" });
        const path = `${attemptId}/${Date.now()}.webm`;

        try {
          const { error } = await supabase.storage
            .from(AUDIO_BUCKET)
            .upload(path, blob, { contentType: "audio/webm", upsert: true });
          if (error) {
            console.warn("[AudioMonitor] ❌ Clip upload failed (does the '" + AUDIO_BUCKET + "' bucket exist?):", error.message);
            return;
          }
          const audioUrl = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(path).data.publicUrl;
          console.log("[AudioMonitor] ✓ Clip uploaded, requesting transcription:", path);
          await post("/api/v1/proctoring/audio-transcript", {
            attempt_id: attemptId,
            audio_url:  audioUrl,
          });
        } catch (err) {
          // Expected to fail with a 404 until /audio-transcript exists on
          // the backend — non-fatal, dB-based noise logging still works.
          console.warn("[AudioMonitor] Transcript request failed (endpoint may not exist yet):", err);
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
      console.log("[AudioMonitor] Unmounted");
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  return null;
}