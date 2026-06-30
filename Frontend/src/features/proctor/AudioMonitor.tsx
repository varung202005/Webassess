/**
 * features/proctor/AudioMonitor.tsx
 * Samples microphone volume every 10s, logs noise events to backend.
 */
import { useEffect, useRef } from "react";
import { post } from "../../lib/api";

interface AudioMonitorProps {
  attemptId: string;
  noiseTreshold?: number;
  checkIntervalMs?: number;
}

const NOISE_THRESHOLD = 60;
const CHECK_INTERVAL  = 10_000;
const LOG_QUIET_EVERY = 6;
const FFT_SIZE        = 2048;

export default function AudioMonitor({
  attemptId,
  noiseTreshold = NOISE_THRESHOLD,
  checkIntervalMs = CHECK_INTERVAL,
}: AudioMonitorProps) {
  const streamRef   = useRef<MediaStream | null>(null);
  const ctxRef      = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkCount  = useRef(0);
  const activeRef   = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    console.log("[AudioMonitor] Mounting — attemptId:", attemptId, "threshold:", noiseTreshold, "dB");

    const sample = async () => {
      if (!activeRef.current || !analyserRef.current) {
        console.warn("[AudioMonitor] sample() skipped — analyser not ready yet");
        return;
      }
      const buffer = new Float32Array(analyserRef.current.fftSize);
      analyserRef.current.getFloatTimeDomainData(buffer);
      const rms       = Math.sqrt(buffer.reduce((s, v) => s + v * v, 0) / buffer.length);
      const db        = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
      const dbDisplay = Math.round(Math.max(0, db + 100));
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
      } catch (err) {
        console.warn("[AudioMonitor] ❌ Mic error:", (err as Error).message);
      }
    };

    void start();

    return () => {
      activeRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      void ctxRef.current?.close();
      console.log("[AudioMonitor] Unmounted");
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  return null;
}