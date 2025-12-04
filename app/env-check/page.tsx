export default function EnvCheckPage() {
  const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
      <h1>Environment Variables Check</h1>
      <div style={{ marginTop: '1rem' }}>
        <p>
          <strong>NEXT_PUBLIC_SUPABASE_URL:</strong>{' '}
          {hasUrl ? '✅ Set' : '❌ Missing'}
        </p>
        <p>
          <strong>NEXT_PUBLIC_SUPABASE_ANON_KEY:</strong>{' '}
          {hasKey ? '✅ Set' : '❌ Missing'}
        </p>
        {hasUrl && (
          <p style={{ marginTop: '1rem', color: 'gray', fontSize: '0.9em' }}>
            URL: {process.env.NEXT_PUBLIC_SUPABASE_URL}
          </p>
        )}
      </div>
      {hasUrl && hasKey ? (
        <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#d4edda', color: '#155724', borderRadius: '4px' }}>
          ✅ Environment variables are properly configured! You can go back to the home page.
        </div>
      ) : (
        <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f8d7da', color: '#721c24', borderRadius: '4px' }}>
          ❌ Environment variables are missing. The dev server needs to restart to load them from .env.local
        </div>
      )}
    </div>
  );
}
