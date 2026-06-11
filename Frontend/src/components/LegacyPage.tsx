import { useEffect, useRef } from "react";

interface LegacyPageProps {
  /** Page-scoped CSS extracted from the original mockup (<style> contents) */
  css?: string;
  /** Page body markup extracted from the original mockup */
  html: string;
  /** Page-scoped vanilla JS extracted from the original mockup (<script> contents) */
  script?: string;
}

/**
 * Renders a page that was authored as a static HTML/CSS/JS mockup.
 *
 * These pages were produced as high-fidelity UI mockups for the design
 * review phase. They are wired up here as real routed React pages so the
 * whole app can be reviewed end-to-end, but the markup/behaviour inside
 * each one should be progressively broken down into proper feature
 * components (see RESPONSIBILITY_MAP.md / API mapping) — replace
 * hard-coded mock data with TanStack Query hooks against the real API,
 * replace inline `onclick` handlers with React event handlers, etc.
 */
export default function LegacyPage({ css, html, script }: LegacyPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!script) return;

    const tag = document.createElement("script");
    tag.text = script;
    document.body.appendChild(tag);

    return () => {
      document.body.removeChild(tag);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script]);

  return (
    <>
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      <div className="legacy-page" ref={containerRef} dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
