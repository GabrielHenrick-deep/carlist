import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function isStandalone(): boolean {
  return (
    // 'fullscreen' fica de fora de propósito: a Fullscreen API também o ativa no navegador comum.
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari iOS
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

// O evento dispara uma única vez, logo no carregamento; por isso fica em um
// store de módulo, para qualquer tela que monte depois ainda enxergá-lo.
let deferred: BeforeInstallPromptEvent | null = null
let installedFlag = false
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    installedFlag = true
    deferred = null
    notify()
  })
}

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** Instalação do PWA: `canInstall` fica true quando o navegador oferece o prompt nativo. */
export function useInstall() {
  const event = useSyncExternalStore(subscribe, () => deferred)
  const installed = useSyncExternalStore(subscribe, () => installedFlag) || isStandalone()

  const install = useCallback(async () => {
    if (!deferred) return
    const ev = deferred
    deferred = null
    notify()
    await ev.prompt()
    const { outcome } = await ev.userChoice
    if (outcome === 'accepted') {
      installedFlag = true
      notify()
    }
  }, [])

  return { canInstall: !!event && !installed, installed, install }
}

/** Tela cheia via Fullscreen API (não existe no iPhone). */
export function useFullscreen() {
  const supported =
    typeof document !== 'undefined' && document.fullscreenEnabled === true
  const [active, setActive] = useState(() => !!document.fullscreenElement)

  useEffect(() => {
    const onChange = () => setActive(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggle = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
    } catch {
      /* o navegador pode negar; nada a fazer */
    }
  }, [])

  return { supported, active, toggle }
}
