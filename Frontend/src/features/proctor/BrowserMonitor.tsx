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
 *   onConflict       — called when a duplicate session is detected
 */
import { useEffect, useRef, useCallback } from "react";
import { post } from "../../lib/api";

interface BrowserMonitorProps {
  attemptId: string;
  fullscreenRequired?: boolean;
  onWarning?: (message: string, type: "tab" | "fullscreen" | "conflict") => void;
  onConflict?: () => void;
}

/** How often (ms) to push a cumulative sync to the backend even if quiet */
const SYNC_INTERVAL_MS = 30_000;

/** BroadcastChannel name — same key in all tabs for this attempt */
const CHANNEL_NAME = "exam-session-monitor";

export default function BrowserMonitor({
  attemptId,
  fullscreenRequired = true,
  onWarning,
  onConflict,
}: BrowserMonitorProps) {
  const tabSwitches     = useRef(0);
  const fullscreenExits = useRef(0);
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
        session_conflict_detected: conflictRef.current,
      });
      console.log(
        `[BrowserMonitor] ✓ synced — tabs:${tabSwitches.current} fs:${fullscreenExits.current} conflict:${conflictRef.current}`
      );
    } catch (err) {
      console.warn("[BrowserMonitor] ❌ sync failed:", err);
    }
  }, [attemptId]);

  useEffect(() => {
    activeRef.current = true;
    console.log("[BrowserMonitor] Mounting — attemptId:", attemptId, "fullscreenRequired:", fullscreenRequired);

    // ── 1. Fullscreen: enter immediately if required ───────────────────────
    if (fullscreenRequired && document.fullscreenElement === null) {
      document.documentElement.requestFullscreen().catch((err) =>
        console.warn("[BrowserMonitor] Could not enter fullscreen:", err)
      );
    }

    // ── 2. Tab / visibility detection ────────────────────────────────────
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
      if (document.fullscreenElement === null && fullscreenRequired) {
        fullscreenExits.current += 1;
        console.log("[BrowserMonitor] Fullscreen exited — total:", fullscreenExits.current);
        onWarning?.(
          `Fullscreen exit detected (${fullscreenExits.current} total). Please return to fullscreen immediately.`,
          "fullscreen"
        );
        void syncToBackend();
      }
    };

    // ── 4. Context-menu blocker (deterrent) ───────────────────────────────
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // ── 5. DevTools / copy-paste key deterrents ───────────────────────────
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block F12, Ctrl+Shift+I/J/C, Ctrl+U (view source)
      const blocked =
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key.toUpperCase())) ||
        (e.ctrlKey && e.key.toUpperCase() === "U");
      if (blocked) {
        e.preventDefault();
        console.warn("[BrowserMonitor] Blocked key:", e.key);
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
          onConflict?.();
          void syncToBackend();
          // Respond so the other tab also knows
          bc?.postMessage({ type: "PONG", attemptId });
        }
        if (ev.data?.type === "PONG" && ev.data?.attemptId === attemptId) {
          conflictRef.current = true;
          console.warn("[BrowserMonitor] ⚠ Duplicate session responded!");
          onConflict?.();
          void syncToBackend();
        }
      };
    } catch {
      console.warn("[BrowserMonitor] BroadcastChannel not supported");
    }

    // ── 7. Periodic background sync ───────────────────────────────────────
    syncTimerRef.current = setInterval(() => void syncToBackend(), SYNC_INTERVAL_MS);

    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      activeRef.current = false;
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
      // Final sync on unmount (exam submitted)
      void syncToBackend();
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
      bc?.close();
      console.log("[BrowserMonitor] Unmounted — final sync sent");
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId, fullscreenRequired]);

  return null;
}