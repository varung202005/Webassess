import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import { studentApi } from "../../features/student/api";
import { candidateApi } from "../../features/candidate/api";
import { useAuthStore } from "../../store/authStore";
import { addFullscreenChangeListener, isFullscreen, requestExamFullscreen } from "../../lib/fullscreen";
import "../../features/proctor/cameraPermission.css";

type Check = "waiting" | "checking" | "passed" | "failed";

interface BrowserFaceDetector {
  detect(source: ImageBitmapSource): Promise<Array<{ boundingBox: DOMRectReadOnly }>>;
}

declare global {
  interface Window {
    FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => BrowserFaceDetector;
  }
}

const CHANNEL = "exam-preflight";

export default function PreExamCheck() {
  const { scheduleId } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const [camera, setCamera] = useState<Check>("waiting");
  const [framing, setFraming] = useState<Check>("waiting");
  const [screen, setScreen] = useState<Check>("waiting");
  const [duplicate, setDuplicate] = useState<Check>("checking");
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const currentUser = useAuthStore((state) => state.user);

  const portal = useQuery({ queryKey: ["student-portal"], queryFn: studentApi.portal });
  const schedule = portal.data?.schedules.find((item) => item.id === scheduleId);

  const setFullscreenCheck = useCallback(() => {
    setScreen(isFullscreen() ? "passed" : "failed");
  }, []);

  useEffect(() => {
    setFullscreenCheck();
    const bc = new BroadcastChannel(`${CHANNEL}:${scheduleId}`);
    channelRef.current = bc;
    bc.onmessage = (event) => {
      if (event.data?.type === "PRESENT") setDuplicate("failed");
      if (event.data?.type === "PING") bc.postMessage({ type: "PRESENT" });
    };
    bc.postMessage({ type: "PING" });
    const timer = window.setTimeout(() => setDuplicate((current) => current === "checking" ? "passed" : current), 500);
    const removeFullscreenListener = addFullscreenChangeListener(setFullscreenCheck);
    return () => { window.clearTimeout(timer); removeFullscreenListener(); bc.close(); };
  }, [scheduleId, setFullscreenCheck]);

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  const enterFullscreen = async () => {
    try {
      await requestExamFullscreen();
      const extended = (window.screen as Screen & { isExtended?: boolean }).isExtended;
      if (extended) throw new Error("An additional display is connected. Disconnect it before starting the exam.");
      setScreen("passed");
    }
    catch (cause) {
      setScreen("failed");
      const message = cause instanceof Error ? cause.message : "Fullscreen is required before the exam can begin.";
      setError(message);
      throw new Error(message);
    }
  };

  const verifyCamera = async () => {
    setError(null); setCamera("checking"); setFraming("checking");
    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setCamera("passed");

      // A face plus a person that extends well below the face is the enforceable
      // browser-side approximation of the requested head-to-waist framing.
      const detector = window.FaceDetector ? new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 }) : null;
      if (!detector) throw new Error("This browser cannot run the required face check. Please use the latest Chrome or Edge.");
      const [faces, model] = await Promise.all([detector.detect(video), cocoSsd.load()]);
      const people = (await model.detect(video)).filter((prediction) => prediction.class === "person" && prediction.score >= 0.6);
      const face = faces[0]?.boundingBox;
      const person = people[0]?.bbox;
      const faceClearlyVisible = Boolean(face && face.width >= video.videoWidth * 0.08 && face.width <= video.videoWidth * 0.5);
      const waistVisible = Boolean(person && face && person[1] <= face.y + face.height && person[1] + person[3] >= video.videoHeight * 0.78);
      if (!faceClearlyVisible || !waistVisible) throw new Error("Keep your face clear and position the camera so your upper body down to your waist is visible, then run the check again.");
      setFraming("passed");
    } catch (cause) {
      setCamera("failed"); setFraming("failed");
      setError(cause instanceof Error ? cause.message : "Camera verification failed. Please try again.");
    }
  };

  const readyForStart = camera === "passed" && framing === "passed" && duplicate === "passed";
  const startExam = async () => {
    if (!scheduleId || !readyForStart || starting) return;
    setStarting(true); setError(null);
    try {
      // This final, synchronous check keeps the backend attempt (and therefore
      // its timer) from starting until the browser is actually fullscreen.
      if (!isFullscreen()) await enterFullscreen();
      if (!isFullscreen()) throw new Error("Fullscreen is required before the exam can begin.");
      if (currentUser?.roles?.includes("CANDIDATE")) await candidateApi.startAttempt();
      else await studentApi.startAttempt(scheduleId);
      navigate(`/exam/live/${scheduleId}`, { replace: true });
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to start the exam."); setStarting(false); }
  };
  const icon = (status: Check) => status === "passed" ? "ti-circle-check-filled" : status === "failed" ? "ti-circle-x-filled" : status === "checking" ? "ti-loader-2 spin" : "ti-clock";

  return <div className="cam-gate">
    <div className="cam-gate-header"><div className="cam-gate-brand"><i className="ti ti-shield-check" /><strong>EXAM.TIET</strong></div><div className="cam-gate-exam"><span className="cam-gate-code">Pre-exam verification</span><span className="cam-gate-title">{schedule?.exam.title ?? "Loading assessment…"}</span></div></div>
    <div className="cam-gate-card">
      <h1 className="cam-gate-heading">System verification</h1>
      <p className="cam-gate-body">The exam stays locked until every required check passes. No declarations or checkboxes are used.</p>
      <div className="cam-preview-wrap"><video ref={videoRef} autoPlay muted playsInline className="cam-preview-video" /><div className="cam-preview-live"><div className="cam-live-dot" />LIVE PREVIEW</div></div>
      <div className="cam-gate-checklist">
        <div className={`cam-check-item check-${camera}`}><i className={`ti ${icon(camera)}`} /><span>Camera connection {camera === "passed" ? "verified" : "required"}</span></div>
        <div className={`cam-check-item check-${framing}`}><i className={`ti ${icon(framing)}`} /><span>Clear face and head-to-waist framing {framing === "passed" ? "verified" : "required"}</span></div>
        <div className={`cam-check-item check-${screen}`}><i className={`ti ${icon(screen)}`} /><span>Fullscreen mode {screen === "passed" ? "verified" : "required"}</span></div>
        <div className={`cam-check-item check-${duplicate}`}><i className={`ti ${icon(duplicate)}`} /><span>Other exam tab/window {duplicate === "passed" ? "not detected" : "checking"}</span></div>
      </div>
      <p className="cam-gate-body" style={{ fontSize: 12 }}>Browser security cannot inspect unrelated tabs or desktop applications. Full kiosk enforcement requires a managed browser or native proctoring agent.</p>
      {error && <p className="cam-gate-body cam-gate-body--error">{error}</p>}
      <button className="cam-gate-btn cam-gate-btn--primary" onClick={() => void verifyCamera()}><i className="ti ti-camera" />Run camera and framing check</button>
      <button className="cam-gate-btn cam-gate-btn--start" disabled={!readyForStart || starting} onClick={() => void startExam()}><i className={screen === "passed" ? "ti ti-player-play-filled" : "ti ti-maximize"} />{starting ? "Starting…" : screen === "passed" ? "Start exam" : "Enter fullscreen & start exam"}</button>
    </div>
  </div>;
}
