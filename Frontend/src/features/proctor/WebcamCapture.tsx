/**
 * features/proctor/WebcamCapture.tsx
 * Captures webcam frames and uploads to Supabase Storage every 30s.
 * First capture happens after 5s.
 */
import { useEffect, useRef, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { post } from "../../lib/api";

interface WebcamCaptureProps {
  attemptId: string;
  studentId: string;
  intervalMs?: number;
  onCapture?: (snapshotUrl: string) => void;
}

const BUCKET           = "exam-snapshots";
const DEFAULT_INTERVAL = 30_000;

export default function WebcamCapture({
  attemptId,
  studentId,
  intervalMs = DEFAULT_INTERVAL,
  onCapture,
}: WebcamCaptureProps) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const activeRef = useRef(true);

  // ── Start webcam ──────────────────────────────────────────────────────────
  useEffect(() => {
    activeRef.current = true;
    console.log("[WebcamCapture] Mounting — attemptId:", attemptId, "studentId:", studentId);

    if (!studentId) {
      console.error("[WebcamCapture] studentId is empty — snapshots will not upload correctly");
    }
    if (!attemptId) {
      console.error("[WebcamCapture] attemptId is empty — snapshots will not upload correctly");
    }

    const startCamera = async () => {
      try {
        console.log("[WebcamCapture] Requesting getUserMedia...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          console.log("[WebcamCapture] Camera stream started ✓");
        }
      } catch (err) {
        console.error("[WebcamCapture] Camera error:", err);
      }
    };

    void startCamera();

    return () => {
      activeRef.current = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      console.log("[WebcamCapture] Unmounted — stream stopped");
    };
  }, [attemptId, studentId]);

  // ── Capture frame ─────────────────────────────────────────────────────────
  const capture = useCallback(async () => {
    if (!activeRef.current) return;

    const video  = videoRef.current;
    const canvas = canvasRef.current;

    console.log("[WebcamCapture] capture() called — video readyState:", video?.readyState, "stream active:", streamRef.current?.active);

    if (!video || !canvas) {
      console.warn("[WebcamCapture] video or canvas ref is null");
      return;
    }
    if (video.readyState < 2) {
      console.warn("[WebcamCapture] Video not ready yet (readyState:", video.readyState, ") — skipping frame");
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) { console.warn("[WebcamCapture] No 2d context"); return; }

    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    console.log("[WebcamCapture] Frame drawn —", canvas.width, "x", canvas.height);

    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/jpeg", 0.8)
    );

    if (!blob) { console.warn("[WebcamCapture] toBlob returned null"); return; }
    console.log("[WebcamCapture] Blob size:", blob.size, "bytes");

    // ── Upload to Supabase Storage ──────────────────────────────────────────
    const path = `${studentId}/${attemptId}/${Date.now()}.jpg`;
    console.log("[WebcamCapture] Uploading to bucket:", BUCKET, "path:", path);

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: "image/jpeg", upsert: true });

    if (error) {
      console.error("[WebcamCapture] ❌ Upload error:", error.message, "| statusCode:", error);
    } else {
      console.log("[WebcamCapture] ✓ Upload success — path:", data.path);
    }

    // ── POST face log (always — even if upload failed) ──────────────────────
    const snapshotUrl = error
      ? null
      : supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

    try {
      console.log("[WebcamCapture] POSTing face log with snapshot_url:", snapshotUrl);
      await post("/api/v1/proctoring/face", {
        attempt_id:       attemptId,
        face_detected:    true,
        identity_matched: true,
        person_count:     1,
        phone_detected:   false,
        confidence_score: 1.0,
        snapshot_url:     snapshotUrl,
      });
      console.log("[WebcamCapture] ✓ Face log posted");
    } catch (postErr) {
      console.error("[WebcamCapture] ❌ Face log POST failed:", postErr);
    }

    if (snapshotUrl) onCapture?.(snapshotUrl);
  }, [attemptId, studentId, onCapture]);

  // ── Interval ──────────────────────────────────────────────────────────────
  useEffect(() => {
    console.log("[WebcamCapture] Setting up capture interval — first in 5s, then every", intervalMs / 1000, "s");
    const warmup = setTimeout(() => void capture(), 5_000);
    const timer  = setInterval(() => void capture(), intervalMs);
    return () => {
      clearTimeout(warmup);
      clearInterval(timer);
    };
  }, [capture, intervalMs]);

  return (
    <>
      <video
        ref={videoRef}
        autoPlay muted playsInline
        style={{ position: "fixed", top: -9999, left: -9999, width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
        aria-hidden
      />
      <canvas ref={canvasRef} style={{ display: "none" }} aria-hidden />
    </>
  );
}