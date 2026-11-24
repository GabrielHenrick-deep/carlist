import { Component, type ReactNode } from 'react'
import { eraseAll } from '../lib/backup'

/**
 * Última rede de segurança: se uma tela quebrar (por exemplo com dados corrompidos),
 * o app mostra uma saída em vez de ficar em branco.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  async wipe() {
    if (!confirm('Apagar TODOS os dados do app neste aparelho? Exporte um backup antes se puder.')) return
    await eraseAll()
    location.hash = '#/'
    location.reload()
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="mx-auto mt-16 max-w-md space-y-3 p-4 text-center">
        <div className="text-5xl" aria-hidden="true">
          ⚠️
        </div>
        <h1 className="text-xl font-bold">Algo deu errado</h1>
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Esta tela não conseguiu abrir. Pode ser um dado inesperado salvo no aparelho. Tente
          recarregar; se continuar, apague os dados e importe um backup bom.
        </p>
        <button className="btn w-full" onClick={() => location.reload()}>
          Recarregar
        </button>
        <button className="btn-secondary w-full !text-red-700 dark:!text-red-300" onClick={() => void this.wipe()}>
          Apagar dados e recomeçar
        </button>
      </div>
    )
  }
}
