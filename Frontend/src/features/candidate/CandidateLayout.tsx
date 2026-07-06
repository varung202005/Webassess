/**
 * CandidateLayout — minimal shell for the candidate flow.
 *
 * Deliberately has NO sidebar, NO notification bell, NO profile menu,
 * NO analytics, NO course links. Just a slim header with the brand
 * and a centered content area.
 */
import type { ReactNode } from "react";
import { useAuthStore } from "../../store/authStore";

const css = `
*,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }
.cand-shell { min-height: 100vh; background: #F7F8FA; font-family: var(--font); display: flex; flex-direction: column; }
.cand-header {
  height: 56px; background: var(--c-primary-700);
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 32px; flex-shrink: 0;
}
.cand-brand { font-size: 18px; font-weight: 800; color: #fff; letter-spacing: -0.3px; }
.cand-brand span { color: rgba(255,255,255,.55); }
.cand-header-right { display: flex; align-items: center; gap: 12px; }
.cand-email { font-size: 13px; color: rgba(255,255,255,.75); }
.cand-signout {
  font-size: 12.5px; font-weight: 600; color: rgba(255,255,255,.85);
  background: rgba(255,255,255,.12); border: none; border-radius: 6px;
  padding: 5px 12px; cursor: pointer; font-family: var(--font);
  transition: background .12s;
}
.cand-signout:hover { background: rgba(255,255,255,.2); }
.cand-body { flex: 1; display: flex; align-items: flex-start; justify-content: center; padding: 40px 16px; }
.cand-content { width: 100%; max-width: 760px; }
@media(max-width:600px) { .cand-header { padding: 0 16px; } .cand-body { padding: 24px 12px; } }
`;

export default function CandidateLayout({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <div className="cand-shell">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <header className="cand-header">
        <div className="cand-brand">EXAM<span>.</span>TIET</div>
        <div className="cand-header-right">
          {user && <span className="cand-email">{user.email}</span>}
          <button className="cand-signout" onClick={signOut}>Sign Out</button>
        </div>
      </header>
      <div className="cand-body">
        <div className="cand-content">{children}</div>
      </div>
    </div>
  );
}
