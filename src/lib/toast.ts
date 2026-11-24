import { useSyncExternalStore } from 'react'

// Toast simples em store de módulo: sobrevive à troca de tela, que é o caso
// típico ("salvou e voltou para a Home").
let message: string | null = null
let timer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()

export function showToast(text: string, ms = 3000) {
  message = text
  listeners.forEach((l) => l())
  clearTimeout(timer)
  timer = setTimeout(() => {
    message = null
    listeners.forEach((l) => l())
  }, ms)
}

export function useToast(): string | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => {
        listeners.delete(cb)
      }
    },
    () => message,
  )
}
