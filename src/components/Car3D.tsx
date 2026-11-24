import { useEffect, useRef, useSyncExternalStore } from 'react'
import { getCarViewer } from '../lib/carViewer'

/** Silhueta leve mostrada só na primeira carga (o modelo depois fica em memória). */
function Silhouette() {
  return (
    <svg
      viewBox="0 0 200 90"
      aria-hidden="true"
      className="w-2/3 max-w-xs animate-pulse text-slate-400/60 dark:text-slate-500/60"
      fill="currentColor"
    >
      <path d="M18 62c0-8 3-13 12-15l22-6 14-17c3-3 6-4 10-4h46c5 0 9 2 12 5l16 15 14 4c8 2 12 7 12 16v6c0 3-2 5-5 5h-9a19 19 0 0 0-38 0H78a19 19 0 0 0-38 0H23c-3 0-5-2-5-5z" />
      <circle cx="59" cy="72" r="13" />
      <circle cx="148" cy="72" r="13" />
    </svg>
  )
}

/**
 * Mostra o visualizador 3D único do app (ver lib/carViewer). Arraste para girar;
 * o scroll da página não é capturado.
 */
export default function Car3D({ className = '' }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewer = getCarViewer()
  const status = useSyncExternalStore(viewer.subscribe, viewer.getStatus)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    viewer.attach(host)
    return () => viewer.detach(host)
  }, [viewer])

  return (
    <div className={`relative ${className}`}>
      <div ref={hostRef} className="absolute inset-0" />
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <Silhouette />
          Carregando modelo 3D…
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-sm text-slate-600 dark:text-slate-400">
          <span aria-hidden="true" className="text-4xl">
            🚗
          </span>
          Modelo 3D indisponível neste aparelho
        </div>
      )}
    </div>
  )
}
