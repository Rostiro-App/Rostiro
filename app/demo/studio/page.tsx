import { Studio } from './Studio'

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ studio?: string }> }) {
  const sp = await searchParams
  const enabled = process.env.NODE_ENV === 'development' || sp?.studio === 'true'
  if (!enabled) {
    return (
      <div className="mono-data" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--t3)', background: 'var(--void)' }}>
        Simulation Studio is available in dev or with ?studio=true
      </div>
    )
  }
  return <Studio />
}
