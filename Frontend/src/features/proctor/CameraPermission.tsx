/**
 * features/proctor/CameraPermission.tsx
 *
 * Pre-exam camera permission gate shown before the exam begins.
 * Student sees a live webcam preview, grants permission, then
 * clicks "Start Exam" to proceed.
 *
 * States:
 *   idle       → asking student to allow camera
 *   requesting → browser permission prompt in progress
 *   granted    → camera live, show preview + Start Exam button
 *   denied     → camera blocked, show instructions to unblock
 *
 * Place at: Frontend/src/features/proctor/CameraPermission.tsx
 */
import { useEffect, useRef, useState } from "react";
import "./cameraPermission.css";

type PermissionState = "idle" | "requesting" | "granted" | "denied";

interface CameraPermissionProps {
  examTitle: string;
  courseCode: string;
  onProceed: () => void;   // Called when student clicks "Start Exam"
  onSkip?: () => void;     // Optional: allow skipping (e.g. if camera_required=false)
  cameraRequired?: boolean; // Default true — hides skip button when true
}

export default function CameraPermission({
  examTitle,
  courseCode,
  onProceed,
  onSkip,
  cameraRequired = true,
}: CameraPermissionProps) {
  const [state,    setState]    = useState<PermissionState>("idle");
  const [errMsg,   setErrMsg]   = useState<string | null>(null);
  const [framingConfirmed, setFramingConfirmed] = useState(false);
  const [workspaceConfirmed, setWorkspaceConfirmed] = useState(false);
  const videoRef   = useRef<HTMLVideoElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);

  // Stop stream on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Attach stream to video element once it mounts (state === "granted")
  useEffect(() => {
    if (state !== "granted") return;
    const video = videoRef.current;
    if (!video || !streamRef.current) return;
    video.srcObject = streamRef.current;
    video.play().catch(() => undefined);
  }, [state]);

  const requestCamera = async () => {
    setState("requesting");
    setErrMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setState("granted");
    } catch (err) {
      const e = err as DOMException;
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
        setState("denied");
        setErrMsg("Camera access was blocked. Please allow camera access to continue.");
      } else if (e.name === "NotFoundError") {
        setState("denied");
        setErrMsg("No camera found on this device. Please connect a webcam.");
      } else {
        setState("denied");
        setErrMsg(`Camera error: ${e.message}`);
      }
    }
  };

  const handleProceed = () => {
    // Keep the stream alive — WebcamCapture will take over the same device
    // We stop it here and let WebcamCapture open a fresh stream
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onProceed();
  };

  return (
    <div className="cam-gate">
      {/* Header */}
      <div className="cam-gate-header">
        <div className="cam-gate-brand">
          <i className="ti ti-shield-check" />
          <strong>EXAM.TIET</strong>
        </div>
        <div className="cam-gate-exam">
          <span className="cam-gate-code">{courseCode}</span>
          <span className="cam-gate-title">{examTitle}</span>
        </div>
      </div>

      {/* Main card */}
      <div className="cam-gate-card">

        {/* ── IDLE: ask for camera ── */}
        {(state === "idle" || state === "requesting") && (
          <>
            <div className="cam-gate-icon cam-gate-icon--blue">
              <i className="ti ti-camera" />
            </div>
            <h1 className="cam-gate-heading">Camera Required</h1>
            <p className="cam-gate-body">
              This exam requires webcam monitoring. Your camera will be used
              to take periodic snapshots during the exam for proctoring purposes.
            </p>

            <div className="cam-gate-checklist">
              <div className="cam-check-item">
                <i className="ti ti-check cam-check-ok" />
                <span>Snapshots every 30 seconds</span>
              </div>
              <div className="cam-check-item">
                <i className="ti ti-check cam-check-ok" />
                <span>No audio is recorded</span>
              </div>
              <div className="cam-check-item">
                <i className="ti ti-check cam-check-ok" />
                <span>Images are used only for identity verification</span>
              </div>
              <div className="cam-check-item">
                <i className="ti ti-lock cam-check-ok" />
                <span>Your data is stored securely</span>
              </div>
            </div>

            <button
              className="cam-gate-btn cam-gate-btn--primary"
              onClick={() => void requestCamera()}
              disabled={state === "requesting"}
            >
              {state === "requesting" ? (
                <>
                  <i className="ti ti-loader-2 spin" />
                  Requesting camera access...
                </>
              ) : (
                <>
                  <i className="ti ti-camera" />
                  Allow Camera & Continue
                </>
              )}
            </button>

            {!cameraRequired && onSkip && (
              <button className="cam-gate-btn cam-gate-btn--ghost" onClick={onSkip}>
                Skip (camera not required for this exam)
              </button>
            )}
          </>
        )}

        {/* ── GRANTED: show preview ── */}
        {state === "granted" && (
          <>
            <div className="cam-preview-wrap">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="cam-preview-video"
              />
              <div className="cam-preview-live">
                <div className="cam-live-dot" />
                LIVE
              </div>
              <div className="cam-preview-corner cam-preview-tl" />
              <div className="cam-preview-corner cam-preview-tr" />
              <div className="cam-preview-corner cam-preview-bl" />
              <div className="cam-preview-corner cam-preview-br" />
            </div>

            <div className="cam-granted-badge">
              <i className="ti ti-circle-check-filled" />
              Camera connected successfully
            </div>

            <h1 className="cam-gate-heading" style={{ marginTop: 16 }}>
              Ready to begin?
            </h1>
            <p className="cam-gate-body">
              Your webcam is active and working. Make sure your face is clearly
              visible and well-lit before starting. Sit in a quiet, well-lit room.
            </p>

            <ul className="cam-gate-rules">
              <li><i className="ti ti-user" />Keep your entire face and both hands visible in the camera frame</li>
              <li><i className="ti ti-sun" />Ensure good lighting (face the light source)</li>
              <li><i className="ti ti-device-mobile-off" />No phones or extra devices</li>
              <li><i className="ti ti-users-minus" />Only you should be in frame</li>
            </ul>

            <div className="cam-gate-checklist">
              <label className="cam-check-item">
                <input type="checkbox" checked={workspaceConfirmed} onChange={(e) => setWorkspaceConfirmed(e.target.checked)} />
                <span>I have closed other apps and browser tabs/windows.</span>
              </label>
              <label className="cam-check-item">
                <input type="checkbox" checked={framingConfirmed} onChange={(e) => setFramingConfirmed(e.target.checked)} />
                <span>My entire face and both hands are visible in this preview.</span>
              </label>
            </div>

            <button
              className="cam-gate-btn cam-gate-btn--start"
              onClick={handleProceed}
              disabled={!framingConfirmed || !workspaceConfirmed}
            >
              <i className="ti ti-player-play-filled" />
              Start Exam
            </button>
          </>
        )}

        {/* ── DENIED: show fix instructions ── */}
        {state === "denied" && (
          <>
            <div className="cam-gate-icon cam-gate-icon--red">
              <i className="ti ti-camera-off" />
            </div>
            <h1 className="cam-gate-heading">Camera Access Blocked</h1>
            <p className="cam-gate-body cam-gate-body--error">{errMsg}</p>

            <div className="cam-fix-steps">
              <p className="cam-fix-heading">How to fix this:</p>
              <div className="cam-fix-step">
                <span className="cam-fix-num">1</span>
                <span>Click the camera icon <strong>🔒</strong> in your browser's address bar</span>
              </div>
              <div className="cam-fix-step">
                <span className="cam-fix-num">2</span>
                <span>Set Camera permission to <strong>Allow</strong></span>
              </div>
              <div className="cam-fix-step">
                <span className="cam-fix-num">3</span>
                <span>Refresh this page and try again</span>
              </div>
            </div>

            <div className="cam-fix-actions">
              <button
                className="cam-gate-btn cam-gate-btn--primary"
                onClick={() => { setState("idle"); setErrMsg(null); }}
              >
                <i className="ti ti-refresh" />
                Try Again
              </button>
              {!cameraRequired && onSkip && (
                <button className="cam-gate-btn cam-gate-btn--ghost" onClick={onSkip}>
                  Skip camera check
                </button>
              )}
            </div>
          </>
        )}

      </div>

      {/* Footer note */}
      <p className="cam-gate-footer">
        <i className="ti ti-lock" />
        Webcam data is used solely for exam integrity. It is never shared with third parties.
      </p>
    </div>
  );
}
