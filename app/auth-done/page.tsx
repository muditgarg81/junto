export default function AuthDonePage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#faf6f1',
        padding: '2rem',
        textAlign: 'center',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✓</div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1a1a', marginBottom: '0.5rem' }}>
        You&apos;re signed in!
      </h1>
      <p style={{ color: '#666', fontSize: '1rem', maxWidth: '280px' }}>
        Close this tab to return to the Junto app.
      </p>
    </div>
  );
}
