export default function HomePage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        textAlign: 'center',
        maxWidth: '400px',
        padding: '2rem',
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: 'bold',
          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '1rem'
        }}>
          FindIA
        </h1>
        <p style={{
          color: '#6b7280',
          marginBottom: '2rem',
          fontSize: '1.1rem'
        }}>
          Tu compañero IA para liberarte de deudas
        </p>
        <div style={{
          padding: '1rem',
          background: '#f3f4f6',
          borderRadius: '8px',
          marginBottom: '1.5rem'
        }}>
          <p style={{ color: '#059669', fontWeight: 'bold', margin: '0.5rem 0' }}>
            ✅ Status: Working
          </p>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
            Build: {new Date().toISOString()}
          </p>
        </div>
        <a 
          href="/dashboard" 
          style={{
            display: 'inline-block',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            color: 'white',
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: '500'
          }}
        >
          Ir al Dashboard
        </a>
      </div>
    </div>
  )
}