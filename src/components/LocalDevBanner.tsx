/**
 * LocalDevBanner — visible solo cuando se corre con `pnpm run dev:local`
 * Astro expone import.meta.env.MODE en el lado del cliente igualmente.
 */
export function LocalDevBanner() {
  if (import.meta.env.MODE !== 'localdev') return null

  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL ?? 'localhost'

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        background: 'linear-gradient(90deg, #f59e0b, #d97706)',
        color: '#1c1917',
        fontSize: '12px',
        fontWeight: 700,
        fontFamily: 'monospace',
        padding: '5px 16px',
        letterSpacing: '0.05em',
        boxShadow: '0 2px 8px rgba(245,158,11,0.4)',
        userSelect: 'none',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#1c1917',
          display: 'inline-block',
          animation: 'localPulse 1.5s ease-in-out infinite',
        }}
      />
      🔧 MODO LOCAL — Supabase:{' '}
      <code style={{ background: 'rgba(0,0,0,0.15)', padding: '1px 6px', borderRadius: 3 }}>
        {supabaseUrl}
      </code>
      &nbsp;— Los datos NO son de producción
      <style>{`
        @keyframes localPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }
      `}</style>
    </div>
  )
}
