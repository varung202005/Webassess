/**
 * features/proctor/WebcamCapture.tsx
 *
 * Captures webcam frames every `intervalMs` and runs REAL, free, in-browser
 * AI analysis on each one before deciding what to do with it:
 *
 *   - @tensorflow-models/coco-ssd  → object detection: "person" (face/people
 *     presence + multi-person count) and "cell phone"/"remote" (phone use).
 *
 * NOTE: this used to also run face-api.js's TinyFaceDetector alongside
 * coco-ssd, but face-api.js bundles a very old TFJS core (~1.7.x) that
 * conflicts with the modern TFJS coco-ssd needs (~4.x) — both register
 * kernels into the same global TFJS registry, which broke coco-ssd's ops
 * with "TypeError: t is not a function". Rather than pin fragile version
 * combinations, we rely solely on coco-ssd's "person" class as the
 * face/person-presence signal (0 people → no face, 2+ → multi-person),
 * which needs no separate face model and has no version conflict.
 *
 * Runs entirely on the student's device — zero API cost, zero server load.
 * Nothing is uploaded to Supabase Storage unless the frame is actually
 * flagged (no person, multiple people, or a phone in frame):
 *
 *   - CLEAN frame   → overwrites one fixed "latest.jpg" per student, purely
 *                     for the proctor's live-feed thumbnail. Storage cost
 *                     for a clean student never grows past ~1 file.
 *   - FLAGGED frame → uploaded under a unique timestamped path and kept
 *                     permanently for proctor review.
 *
 * REQUIRES (add to package.json):
 *   npm install @tensorflow/tfjs @tensorflow-models/coco-ssd
 */
import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "../../lib/supabase";
import { post } from "../../lib/api";
import * as cocoSsdStatic from "@tensorflow-models/coco-ssd";
import * as tfStatic from "@tensorflow/tfjs";

interface WebcamCaptureProps {
  attemptId: string;
  studentId: string;
  intervalMs?: number;
  onCapture?: (snapshotUrl: string) => void;
}

const BUCKET             = "exam-snapshots";
const DEFAULT_INTERVAL   = 30_000;
const PHONE_CONFIDENCE   = 0.4;    // coco-ssd "cell phone"/"remote" score threshold
const PERSON_CONFIDENCE  = 0.5;    // coco-ssd "person" score threshold

type DetectionResult = {
  faceDetected: boolean;
  personCount: number;
  phoneDetected: boolean;
  flagReasons: string[];
};

type DetectedObject = {
  class: string;
  score: number;
};

type CocoSsdModule = {
  load: (options?: { base?: string }) => Promise<{ detect: (video: HTMLVideoElement) => Promise<DetectedObject[]> }>;
};

type TensorflowModule = {
  ready: () => Promise<void>;
};

export default function WebcamCapture({
  attemptId,
  studentId,
  intervalMs = DEFAULT_INTERVAL,
  onCapture,
}: WebcamCaptureProps) {
  const videoRef       = useRef<HTMLVideoElement>(null);
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const streamRef      = useRef<MediaStream | null>(null);
  const activeRef      = useRef(true);
  const modelsReadyRef = useRef(false);
  const cocoModelRef   = useRef<{ detect: (video: HTMLVideoElement) => Promise<DetectedObject[]> } | null>(null);
  const [modelsLoading, setModelsLoading] = useState(true);

  // ── Load AI model once (free, client-side, cached by browser) ─────────────
  useEffect(() => {
    let cancelled = false;

    const loadModels = async () => {
      try {
        console.log("[WebcamCapture] Loading AI model (coco-ssd)...");
        const cocoSsd = cocoSsdStatic as unknown as CocoSsdModule;
        const tf      = tfStatic as unknown as TensorflowModule;
        await tf.ready();
        const cocoModel = await cocoSsd.load({ base: "lite_mobilenet_v2" });

        if (cancelled) return;
        cocoModelRef.current = cocoModel;
        modelsReadyRef.current = true;
        setModelsLoading(false);
        console.log(
          "%c[WebcamCapture] ✓✓✓ AI DETECTION ACTIVE — coco-ssd loaded successfully",
          "color: #16a34a; font-weight: bold;"
        );
      } catch (err) {
        console.error(
          "%c[WebcamCapture] ❌❌❌ AI MODEL FAILED TO LOAD — phone/face detection is OFFLINE, every frame will be flagged for manual review instead. Root cause below:",
          "color: #dc2626; font-weight: bold;",
          err
        );
        // Fail safe: if the model can't load (offline, blocked CDN, low-end
        // device), every frame gets flagged for manual review instead of
        // silently trusting an unanalyzed frame as clean.
        modelsReadyRef.current = false;
        setModelsLoading(false);
      }
    };

    void loadModels();
    return () => { cancelled = true; };
  }, []);

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

  // ── Run AI detection on the current video frame ────────────────────────────
  const runDetection = useCallback(async (video: HTMLVideoElement): Promise<DetectionResult> => {
    if (!modelsReadyRef.current || !cocoModelRef.current) {
      // Model unavailable — safe default: don't fabricate a violation, but
      // note it wasn't actually verified by AI (confidence_score below
      // reflects this so a proctor can tell "unverified" from "AI-cleared").
      return {
        faceDetected: true,
        personCount: 1,
        phoneDetected: false,
        flagReasons: ["AI model unavailable — manual review"],
      };
    }

    const flagReasons: string[] = [];
    const objectPredictions = await cocoModelRef.current.detect(video);

    // coco-ssd's "person" class is used as the face/people-presence signal —
    // no separate face model needed (see file header for why face-api.js
    // was dropped).
    const personCount = objectPredictions.filter(
      (p: DetectedObject) => p.class === "person" && p.score >= PERSON_CONFIDENCE
    ).length;

    const faceDetected = personCount > 0;
    const phoneDetected = objectPredictions.some(
      (p: DetectedObject) => (p.class === "cell phone" || p.class === "remote") && p.score >= PHONE_CONFIDENCE
    );

    if (!faceDetected)   flagReasons.push("No face visible");
    if (personCount > 1) flagReasons.push(`${personCount} people in frame`);
    if (phoneDetected)   flagReasons.push("Phone detected");

    console.log(
      "[WebcamCapture] Raw object predictions:",
      objectPredictions.map((p: DetectedObject) => `${p.class} (${p.score.toFixed(2)})`).join(", ") || "none"
    );

    return { faceDetected, personCount, phoneDetected, flagReasons };
  }, []);

  // ── Capture frame ─────────────────────────────────────────────────────────
  const capture = useCallback(async () => {
    if (!activeRef.current) return;

    const video  = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;
    if (video.readyState < 2) {
      console.warn("[WebcamCapture] Video not ready yet — skipping frame");
      return;
    }

    const detection = await runDetection(video);
    console.log(
      `[WebcamCapture] Detection — modelsReady:${modelsReadyRef.current} face:${detection.faceDetected} people:${detection.personCount} phone:${detection.phoneDetected}`
    );
    // If the AI models never loaded, we can't verify the frame at all —
    // treat it as flagged for manual review rather than silently trusting
    // the "clean" defaults returned by the fallback path. This was the bug:
    // a failed model load used to look identical to "verified clean."
    const flagged = !modelsReadyRef.current ||
      !detection.faceDetected || detection.personCount > 1 || detection.phoneDetected;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/jpeg", 0.8)
    );
    if (!blob) { console.warn("[WebcamCapture] toBlob returned null"); return; }

    // ── Storage-saving upload strategy ────────────────────────────────────
    // Clean frame   → overwrite one fixed "latest.jpg" (live feed only,
    //                 flat storage cost forever).
    // Flagged frame → unique timestamped path, kept permanently for review.
    const path = flagged
      ? `${studentId}/${attemptId}/${Date.now()}.jpg`
      : `${studentId}/${attemptId}/latest.jpg`;

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: "image/jpeg", upsert: true });

    if (error) {
      console.error("[WebcamCapture] ❌ Upload error:", error.message);
    } else {
      console.log(
        `[WebcamCapture] ✓ ${flagged ? "FLAGGED" : "clean"} frame uploaded — ${data.path}`,
        flagged ? detection.flagReasons.join(", ") : ""
      );
    }

    const snapshotUrl = error
      ? null
      : supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

    try {
      await post("/api/v1/proctoring/face", {
        attempt_id:       attemptId,
        face_detected:    detection.faceDetected,
        identity_matched: true,
        person_count:     detection.personCount,
        phone_detected:   detection.phoneDetected,
        confidence_score: modelsReadyRef.current ? 1.0 : 0.0,
        snapshot_url:     snapshotUrl,
      });
    } catch (postErr) {
      console.error("[WebcamCapture] ❌ Face log POST failed:", postErr);
    }

    if (snapshotUrl) onCapture?.(snapshotUrl);
  }, [attemptId, studentId, onCapture, runDetection]);

  // ── Interval ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (modelsLoading) return; // wait for models before the first capture
    console.log("[WebcamCapture] Starting capture interval — every", intervalMs / 1000, "s");
    const warmup = setTimeout(() => void capture(), 3_000);
    const timer  = setInterval(() => void capture(), intervalMs);
    return () => {
      clearTimeout(warmup);
      clearInterval(timer);
    };
  }, [capture, intervalMs, modelsLoading]);

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