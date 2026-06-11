interface PlaceholderPageProps {
  title: string;
  description: string;
  apiHint?: string;
}

/**
 * Simple placeholder for sitemap routes that don't have a converted
 * mockup yet. Keeps the app/router complete per the sitemap while the
 * corresponding screen is designed.
 */
export default function PlaceholderPage({ title, description, apiHint }: PlaceholderPageProps) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--c-bg)",
        fontFamily: "var(--font)",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "var(--c-card)",
          border: "1px solid var(--c-border)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-md)",
          padding: "40px 48px",
          maxWidth: 480,
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            margin: "0 auto 16px",
            borderRadius: "var(--radius-lg)",
            background: "var(--c-primary-100)",
            color: "var(--c-primary-700)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
          }}
        >
          <i className="ti ti-tools" />
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--c-gray-900)", marginBottom: 8 }}>{title}</h1>
        <p style={{ fontSize: 14, color: "var(--c-gray-600)", lineHeight: 1.6 }}>{description}</p>
        {apiHint && (
          <code
            style={{
              display: "inline-block",
              marginTop: 16,
              fontSize: 12,
              background: "var(--c-gray-100)",
              border: "1px solid var(--c-border)",
              borderRadius: "var(--radius-md)",
              padding: "6px 10px",
              color: "var(--c-gray-700)",
            }}
          >
            {apiHint}
          </code>
        )}
      </div>
    </div>
  );
}
