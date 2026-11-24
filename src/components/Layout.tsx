import { Link, Outlet, useLocation } from 'react-router-dom'
import { useFullscreen, useInstall } from '../lib/pwa'
import { useToast } from '../lib/toast'

const tabs = [
  { to: '/', label: 'Início', icon: '🏠' },
  { to: '/historico', label: 'Histórico', icon: '📋' },
  { to: '/registrar/abastecimento', label: 'Novo', icon: '➕', primary: true },
  { to: '/plano', label: 'Plano', icon: '🔧' },
  { to: '/carro', label: 'Carro', icon: '🚗' },
]

export default function Layout() {
  const { canInstall, install } = useInstall()
  const fullscreen = useFullscreen()
  const toast = useToast()
  const { pathname } = useLocation()
  // Editar um registro (/registrar/tipo/id) conta como Histórico, não como "Novo".
  const editing = /^\/registrar\/[^/]+\/[^/]+/.test(pathname)
  const isActive = (to: string) => {
    if (to === '/') return pathname === '/'
    if (to === '/historico') return pathname.startsWith('/historico') || pathname.startsWith('/analises') || editing
    if (to.startsWith('/registrar')) return pathname.startsWith('/registrar') && !editing
    if (to === '/plano') return pathname.startsWith('/plano') || pathname.startsWith('/precos')
    return pathname.startsWith(to)
  }

  return (
    <div className="mx-auto min-h-screen max-w-2xl pb-24">
      <header className="sticky top-0 z-10 flex items-center justify-between bg-slate-100/95 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur dark:bg-slate-900/95">
        <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
          <span aria-hidden="true">🚗</span> CarList
        </span>
        <div className="flex items-center gap-2">
          {canInstall && (
            <button
              type="button"
              onClick={install}
              className="min-h-11 rounded-full bg-sky-700 px-4 py-1.5 text-xs font-semibold text-white"
            >
              Instalar app
            </button>
          )}
          {fullscreen.supported && (
            <button
              type="button"
              onClick={fullscreen.toggle}
              aria-label={fullscreen.active ? 'Sair da tela cheia' : 'Tela cheia'}
              title={fullscreen.active ? 'Sair da tela cheia' : 'Tela cheia'}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-200 text-base dark:bg-slate-700"
            >
              <span aria-hidden="true">{fullscreen.active ? '🗗' : '⛶'}</span>
            </button>
          )}
        </div>
      </header>

      <main className="p-4">
        <Outlet />
      </main>

      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-20 flex justify-center px-4"
      >
        {toast && (
          <div className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg dark:bg-slate-100 dark:text-slate-900">
            {toast}
          </div>
        )}
      </div>

      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-700 dark:bg-slate-800/95"
      >
        <ul className="mx-auto flex max-w-2xl items-stretch justify-around">
          {tabs.map((t) => (
            <li key={t.to} className="flex-1">
              <Link
                to={t.to}
                aria-current={isActive(t.to) ? 'page' : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 py-1.5 text-xs ${
                  isActive(t.to)
                    ? 'font-semibold text-sky-700 dark:text-sky-400'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={
                    t.primary
                      ? 'flex h-9 w-9 items-center justify-center rounded-full bg-sky-700 text-base text-white'
                      : 'text-xl leading-9'
                  }
                >
                  {t.icon}
                </span>
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
