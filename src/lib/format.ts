const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})
const number1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
const number0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

export const fmtMoney = (v: number) => money.format(v)
export const fmtKm = (v: number) => `${number0.format(v)} km`
export const fmtNum = (v: number) => number1.format(v)
/** Inteiro com separador de milhar, sem unidade (ex.: 6.500). */
export const fmtNumber = (v: number) => number0.format(v)

/** Data de hoje (fuso local) no formato YYYY-MM-DD. */
export function today(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** YYYY-MM-DD -> DD/MM/YYYY (sem passar por fuso horário). */
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function utc(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((utc(toIso) - utc(fromIso)) / 86_400_000)
}

export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1 + months, 1))
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate()
  target.setUTCDate(Math.min(d, lastDay))
  return target.toISOString().slice(0, 10)
}

/** "2026-11" a partir de uma data ISO. */
export const monthKey = (iso: string) => iso.slice(0, 7)

/** Converte texto de input em número, ou null se vazio/inválido. */
export function toNum(s: string): number | null {
  if (s.trim() === '') return null
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** "1 dia" / "2 dias". */
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
