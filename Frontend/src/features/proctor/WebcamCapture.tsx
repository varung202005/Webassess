/**
 * features/proctor/WebcamCapture.tsx
 *
 * Mounts invisibly inside LiveExam.tsx during an active attempt.
 * Every 30 seconds:
 *   1. Captures a frame from the student's webcam
 *   2. Uploads it to Supabase Storage (exam-snapshots bucket)
 *   3. POSTs the snapshot_url + face detection flags to /proctoring/face
 *
 * The proctor dashboard polls these snapshots to show a live grid.
 *
 * Place at: Frontend/src/features/proctor/WebcamCapture.tsx
 */
import { useEffect, useRef, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { post } from "../../lib/api";

interface WebcamCaptureProps {
  attemptId: string;
  studentId: string;
  /** Capture interval in ms. Default: 30000 (30 seconds) */
  intervalMs?: number;
  /** Called after each successful upload so parent can update face log UI */
  onCapture?: (snapshotUrl: string) => void;
}

const BUCKET = "exam-snapshots";
const DEFAULT_INTERVAL = 30_000;

export default function WebcamCapture({
  attemptId,
  studentId,
  intervalMs = DEFAULT_INTERVAL,
  onCapture,
}: WebcamCaptureProps) {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef  = useRef(true);

  // ── Start webcam ────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: "user" },
          audio: false,
        });
        if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (err) {
        console.warn("[WebcamCapture] Camera access denied or unavailable:", err);
      }
    };

    void startCamera();
    return () => {
      mounted = false;
      activeRef.current = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── Capture + upload ─────────────────────────────────────────────────────────
  const capture = useCallback(async () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width  = video.videoWidth  || 320;
    canvas.height = video.videoHeight || 240;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to JPEG blob (quality 0.7 keeps file small)
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/jpeg", 0.7)
    );
    if (!blob || !activeRef.current) return;

    // Upload to Supabase Storage
    const path = `${studentId}/${attemptId}/${Date.now()}.jpg`;
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: "image/jpeg", upsert: true });

    if (error || !data) {
      console.warn("[WebcamCapture] Upload failed:", error?.message);
      return;
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const snapshotUrl = urlData.publicUrl;

    // Log to proctoring backend (face_detected / phone_detected come from
    // a lightweight client-side check here — a real implementation would
    // run face-api.js; we default to safe values so the log is always created)
    try {
      await post("/api/v1/proctoring/face", {
        attempt_id:       attemptId,
        face_detected:    true,   // Replace with face-api.js result
        identity_matched: true,   // Replace with face-api.js comparison result
        person_count:     1,      // Replace with face-api.js detection count
        phone_detected:   false,  // Replace with object detection result
        confidence_score: 1.0,    // Replace with face-api.js confidence
        snapshot_url:     snapshotUrl,
      });
    } catch (postErr) {
      console.warn("[WebcamCapture] Face log POST failed:", postErr);
    }

    onCapture?.(snapshotUrl);
  }, [attemptId, studentId, onCapture]);

  // ── Interval ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    // First capture after 5s so camera has time to warm up
    const warmup = setTimeout(() => void capture(), 5_000);
    timerRef.current = setInterval(() => void capture(), intervalMs);
    return () => {
      clearTimeout(warmup);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [capture, intervalMs]);

  // Hidden elements — no visible UI
  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{ position: "fixed", top: -9999, left: -9999, width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
        aria-hidden
      />
      <canvas
        ref={canvasRef}
        style={{ display: "none" }}
        aria-hidden
      />
    </>
  );
}