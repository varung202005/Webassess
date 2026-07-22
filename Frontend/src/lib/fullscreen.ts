/** Cross-browser fullscreen helpers used by the secure exam flow. */
type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  msFullscreenElement?: Element | null;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

export function isFullscreen(): boolean {
  const doc = document as FullscreenDocument;
  return Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement ?? doc.msFullscreenElement);
}

export async function requestExamFullscreen(): Promise<void> {
  const element = document.documentElement as FullscreenElement;
  const request = element.requestFullscreen ?? element.webkitRequestFullscreen ?? element.msRequestFullscreen;
  if (!request) throw new Error("Fullscreen is not supported by this browser. Please use a current desktop browser.");
  await Promise.resolve(request.call(element));

  // Some browsers resolve their request before updating fullscreenElement.
  // Wait for the corresponding browser event instead of relying on a fixed delay.
  if (!isFullscreen()) await waitForFullscreen(750);
  if (!isFullscreen()) throw new Error("Fullscreen could not be enabled. Check your browser permissions and try again.");
}

function waitForFullscreen(timeout: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => { cleanup(); resolve(); };
    const timer = window.setTimeout(done, timeout);
    const cleanup = () => {
      window.clearTimeout(timer);
      document.removeEventListener("fullscreenchange", done);
      document.removeEventListener("webkitfullscreenchange", done as EventListener);
      document.removeEventListener("MSFullscreenChange", done as EventListener);
    };
    document.addEventListener("fullscreenchange", done, { once: true });
    document.addEventListener("webkitfullscreenchange", done as EventListener, { once: true });
    document.addEventListener("MSFullscreenChange", done as EventListener, { once: true });
  });
}

export function addFullscreenChangeListener(listener: () => void): () => void {
  document.addEventListener("fullscreenchange", listener);
  document.addEventListener("webkitfullscreenchange", listener as EventListener);
  document.addEventListener("MSFullscreenChange", listener as EventListener);
  return () => {
    document.removeEventListener("fullscreenchange", listener);
    document.removeEventListener("webkitfullscreenchange", listener as EventListener);
    document.removeEventListener("MSFullscreenChange", listener as EventListener);
  };
}
