import type { CSSProperties } from 'react';

const rowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 0',
  borderBottom: '1px solid #334155'
};

const cardStyle: CSSProperties = {
  border: '1px solid #334155',
  borderRadius: 12,
  padding: 20,
  background: '#111827'
};

export default function HomePage() {
  return (
    <main style={{ maxWidth: 960, margin: '48px auto', padding: '0 20px' }}>
      <h1 style={{ fontSize: 34, marginBottom: 8 }}>Ashfox Control Plane</h1>
      <p style={{ marginTop: 0, color: '#94a3b8' }}>
        Dashboard/API scaffold for multi-user sessions with pluggable backends (blockbench | engine).
      </p>
      <section style={cardStyle}>
        <div style={rowStyle}>
          <strong>Dashboard</strong>
          <span>Scaffolded</span>
        </div>
        <div style={rowStyle}>
          <strong>API health</strong>
          <span>
            <code>/api/health</code>
          </span>
        </div>
        <div style={rowStyle}>
          <strong>MCP entry (placeholder)</strong>
          <span>
            <code>/api/mcp</code>
          </span>
        </div>
      </section>
    </main>
  );
}
