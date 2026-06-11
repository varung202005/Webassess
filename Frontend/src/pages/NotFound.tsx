import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--c-bg)",
        fontFamily: "var(--font)",
        gap: 12,
      }}
    >
      <div style={{ fontSize: 48, fontWeight: 800, color: "var(--c-primary-700)" }}>404</div>
      <div style={{ fontSize: 14, color: "var(--c-gray-600)" }}>This page doesn't exist.</div>
      <Link
        to="/login"
        style={{
          marginTop: 8,
          padding: "8px 16px",
          background: "var(--c-primary-700)",
          color: "#fff",
          borderRadius: "var(--radius-lg)",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        Back to Login
      </Link>
    </div>
  );
}
