/**
 * features/proctor/BrowserMonitor.tsx
 *
 * Monitors browser integrity events during an exam:
 *   - Tab visibility changes  (document.visibilityState)
 *   - Fullscreen exits        (document.fullscreenchange)
 *   - Session conflicts       (duplicate window/tab via BroadcastChannel)
 *   - Context-menu / devtools shortcuts (optional deterrents)
 *
 * Calls POST /api/v1/proctoring/browser with cumulative counts every
 * SYNC_INTERVAL_MS and immediately after each event.
 *
 * Props:
 *   attemptId        — UUID of the active exam attempt
 *   fullscreenRequired — whether to request + enforce fullscreen
 *   onWarning        — called with a human-readable message each event
 *                      (so LiveExam can show a toast/banner)
 */
import { useEffect, useRef, useCallback } from "react";
import { post } from "../../lib/api";
import { addFullscreenChangeListener, isFullscreen } from "../../lib/fullscreen";

export type ViolationType = "tab" | "fullscreen" | "conflict" | "clipboard" | "screenshot" | "print";

interface BrowserMonitorProps {
  attemptId: string;
  fullscreenRequired?: boolean;
  onWarning?: (message: string, type: ViolationType) => void;
}

/** How often (ms) to push a cumulative sync to the backend even if quiet */
const SYNC_INTERVAL_MS = 30_000;

/** BroadcastChannel name — same key in all tabs for this attempt */
const CHANNEL_NAME = "exam-session-monitor";

export default function BrowserMonitor({
  attemptId,
  fullscreenRequired = true,
  onWarning,
}: BrowserMonitorProps) {
  const tabSwitches     = useRef(0);
  const fullscreenExits = useRef(0);
  const clipboardViolations  = useRef(0);
  const screenshotViolations = useRef(0);
  const printViolations      = useRef(0);
  const conflictRef     = useRef(false);
  const activeRef       = useRef(true);
  const syncTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── POST cumulative counts to backend ──────────────────────────────────────
  const syncToBackend = useCallback(async () => {
    if (!activeRef.current) return;
    try {
      await post("/api/v1/proctoring/browser", {
        attempt_id:                attemptId,
        tab_switch_count:          tabSwitches.current,
        fullscreen_exit_count:     fullscreenExits.current,
        focus_loss_count:          0,
        clipboard_violation_count: clipboardViolations.current,
        screenshot_violation_count:screenshotViolations.current,
        print_violation_count:     printViolations.current,
        session_conflict_detected: conflictRef.current,
      });
      console.log(
        `[BrowserMonitor] ✓ synced — tabs:${tabSwitches.current} fs:${fullscreenExits.current} clip:${clipboardViolations.current} screen:${screenshotViolations.current} print:${printViolations.current} conflict:${conflictRef.current}`
      );
    } catch (err) {
      console.warn("[BrowserMonitor] ❌ sync failed:", err);
    }
  }, [attemptId]);

  useEffect(() => {
    activeRef.current = true;
    console.log("[BrowserMonitor] Mounting — attemptId:", attemptId, "fullscreenRequired:", fullscreenRequired);

    // Proactively clear clipboard on start
    navigator.clipboard?.writeText("").catch(() => undefined);

    // ── 1. Tab / visibility detection ────────────────────────────────────
    const handleVisibility = () => {
      if (!activeRef.current) return;
      if (document.hidden) {
        tabSwitches.current += 1;
        console.log("[BrowserMonitor] Tab hidden — total switches:", tabSwitches.current);
        onWarning?.(
          `Tab switch detected (${tabSwitches.current} total). Switching tabs during an exam is a violation.`,
          "tab"
        );
        void syncToBackend();
      }
    };

    // ── 3. Fullscreen exit detection ──────────────────────────────────────
    const handleFullscreenChange = () => {
      if (!activeRef.current) return;
      if (!isFullscreen() && fullscreenRequired) {
        fullscreenExits.current += 1;
        console.log("[BrowserMonitor] Fullscreen exited — total:", fullscreenExits.current);
        onWarning?.(
          `Fullscreen exit detected (${fullscreenExits.current} total). Please return to fullscreen immediately.`,
          "fullscreen"
        );
        void syncToBackend();
      }
    };

    // ── 4. Context-menu & Drag/Drop blocker (deterrent) ───────────────────
    const preventDefaultAction = (e: Event) => {
      e.preventDefault();
    };

    // ── 4.5 Clipboard blocker ─────────────────────────────────────────────
    const handleClipboard = (e: ClipboardEvent) => {
      e.preventDefault();
      clipboardViolations.current += 1;
      onWarning?.("Copying, cutting, and pasting are disabled during the exam.", "clipboard");
      void syncToBackend();
    };

    // ── 5. DevTools / copy-paste key deterrents ───────────────────────────
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      const key = e.key.toUpperCase();

      // Block F12, Ctrl+Shift+I/J/C, Ctrl+U (view source)
      const devToolsBlocked =
        key === "F12" ||
        (isCmdOrCtrl && e.shiftKey && ["I", "J", "C"].includes(key)) ||
        (isCmdOrCtrl && key === "U");

      // Block Ctrl+P (Print), Ctrl+C/V/X/A (Clipboard/Selection)
      const actionBlocked = isCmdOrCtrl && ["P", "C", "V", "X", "A"].includes(key);

      if (devToolsBlocked || actionBlocked) {
        e.preventDefault();
        console.warn("[BrowserMonitor] Blocked key:", e.key);
        
        if (key === "P") {
          printViolations.current += 1;
          onWarning?.("Printing is disabled during the exam.", "print");
        } else if (["C", "V", "X", "A"].includes(key)) {
          clipboardViolations.current += 1;
          onWarning?.("Clipboard and selection shortcuts are disabled.", "clipboard");
        }
        void syncToBackend();
      }

      // Detect PrintScreen (cannot be prevented, but we can detect and warn)
      if (key === "PRINTSCREEN" || e.code === "PrintScreen") {
        screenshotViolations.current += 1;
        onWarning?.("Screenshots are prohibited. This action has been logged.", "screenshot");
        void syncToBackend();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase();
      if (key === "PRINTSCREEN" || e.code === "PrintScreen") {
        screenshotViolations.current += 1;
        onWarning?.("Screenshots are prohibited. This action has been logged.", "screenshot");
        void syncToBackend();
      }
    };

    // ── 6. Duplicate-session detection via BroadcastChannel ──────────────
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(`${CHANNEL_NAME}:${attemptId}`);

      // Announce ourselves
      bc.postMessage({ type: "PING", attemptId });

      bc.onmessage = (ev) => {
        if (ev.data?.type === "PING" && ev.data?.attemptId === attemptId) {
          // Another tab is open for the same attempt
          conflictRef.current = true;
          console.warn("[BrowserMonitor] ⚠ Duplicate session detected!");
          onWarning?.(
            "Another browser tab or window with this exam was detected. This is a violation.",
            "conflict"
          );
          void syncToBackend();
          // Respond so the other tab also knows
          bc?.postMessage({ type: "PONG", attemptId });
        }
        if (ev.data?.type === "PONG" && ev.data?.attemptId === attemptId) {
          conflictRef.current = true;
          console.warn("[BrowserMonitor] ⚠ Duplicate session responded!");
          void syncToBackend();
        }
      };
    } catch {
      console.warn("[BrowserMonitor] BroadcastChannel not supported");
    }

    // ── 7. Periodic background sync ───────────────────────────────────────
    syncTimerRef.current = setInterval(() => void syncToBackend(), SYNC_INTERVAL_MS);

    // ── 8. DevTools "Debugger Trap" ───────────────────────────────────────
    // If they open DevTools, the browser pauses here, freezing the exam.
    const devToolsInterval = setInterval(() => {
      // eslint-disable-next-line no-debugger
      debugger;
    }, 1000);

    // ── 9. Multiple Display Detection ─────────────────────────────────────
    // Modern Chromium supports window.screen.isExtended to check for multiple displays
    const screenInterval = setInterval(() => {
      if (!activeRef.current) return;
      // @ts-expect-error isExtended is a newer property not in all TS dom libs
      if (window.screen && window.screen.isExtended) {
        onWarning?.(
          "Multiple displays detected. Please disconnect external monitors to continue the exam.",
          "conflict"
        );
      }
    }, 5000);

    // ── 10. Print / Save As PDF Blocker ───────────────────────────────────
    const handleBeforePrint = () => {
      printViolations.current += 1;
      onWarning?.("Printing or saving as PDF is prohibited and results in a blank page.", "print");
      void syncToBackend();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    const removeFullscreenListener = addFullscreenChangeListener(handleFullscreenChange);
    document.addEventListener("contextmenu", preventDefaultAction);
    document.addEventListener("dragstart", preventDefaultAction);
    document.addEventListener("drop", preventDefaultAction);
    document.addEventListener("copy", handleClipboard);
    document.addEventListener("cut", handleClipboard);
    document.addEventListener("paste", handleClipboard);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    window.addEventListener("beforeprint", handleBeforePrint);

    return () => {
      activeRef.current = false;
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
      clearInterval(devToolsInterval);
      clearInterval(screenInterval);
      // Final sync on unmount (exam submitted)
      void syncToBackend();
      document.removeEventListener("visibilitychange", handleVisibility);
      removeFullscreenListener();
      document.removeEventListener("contextmenu", preventDefaultAction);
      document.removeEventListener("dragstart", preventDefaultAction);
      document.removeEventListener("drop", preventDefaultAction);
      document.removeEventListener("copy", handleClipboard);
      document.removeEventListener("cut", handleClipboard);
      document.removeEventListener("paste", handleClipboard);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("beforeprint", handleBeforePrint);
      bc?.close();
      console.log("[BrowserMonitor] Unmounted — final sync sent");
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId, fullscreenRequired]);

  return null;
}
