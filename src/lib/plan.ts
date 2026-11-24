import type { MaintenanceRecord, PlanItem } from '../db'
import { addMonths, daysBetween } from './format'

export type PlanLevel = 'overdue' | 'soon' | 'ok' | 'unknown'

export interface PlanStatus {
  item: PlanItem
  lastKm: number | null
  lastDate: string | null
  nextKm: number | null
  nextDate: string | null
  kmLeft: number | null
  daysLeft: number | null
  /** Km rodados desde a última execução (só se o item tem intervalo em km). */
  kmUsed: number | null
  /** Dias desde a última execução e duração total do intervalo em dias. */
  daysUsed: number | null
  daysTotal: number | null
  /** Quanto do intervalo já foi consumido, de 0 a 1 (vale o que estiver mais perto de vencer). */
  progress: number | null
  /** Como `progress`, mas sem teto: passa de 1 quando já venceu (serve para ordenar os vencidos). */
  overshoot: number | null
  level: PlanLevel
}

export const SOON_KM = 1000
export const SOON_DAYS = 30
export const SOON_PROGRESS = 0.8

export function planStatus(
  item: PlanItem,
  maintenance: MaintenanceRecord[],
  curKm: number,
  todayIso: string,
): PlanStatus {
  // Última execução: serviço registrado mais recente que inclui o item,
  // ou o valor informado manualmente no cadastro do item.
  const done = maintenance
    .filter((m) => item.id !== undefined && m.planItemIds.includes(item.id))
    .sort((a, b) => b.date.localeCompare(a.date) || b.km - a.km)[0]

  let lastKm: number | null = item.lastKm
  let lastDate: string | null = item.lastDate
  if (done && (!item.lastDate || done.date >= item.lastDate)) {
    lastKm = done.km
    lastDate = done.date
  }

  const nextKm =
    item.intervalKm && lastKm !== null ? lastKm + item.intervalKm : null
  const nextDate =
    item.intervalMonths && lastDate ? addMonths(lastDate, item.intervalMonths) : null
  const kmLeft = nextKm !== null ? nextKm - curKm : null
  const daysLeft = nextDate ? daysBetween(todayIso, nextDate) : null

  let level: PlanLevel
  if (kmLeft === null && daysLeft === null) level = 'unknown'
  else if ((kmLeft !== null && kmLeft <= 0) || (daysLeft !== null && daysLeft < 0))
    level = 'overdue'
  else if (
    (kmLeft !== null && kmLeft <= SOON_KM) ||
    (daysLeft !== null && daysLeft <= SOON_DAYS)
  )
    level = 'soon'
  else level = 'ok'

  const kmUsed =
    item.intervalKm && lastKm !== null ? Math.max(0, curKm - lastKm) : null
  const daysUsed = lastDate && nextDate ? Math.max(0, daysBetween(lastDate, todayIso)) : null
  const daysTotal = lastDate && nextDate ? daysBetween(lastDate, nextDate) : null

  const fractions: number[] = []
  if (kmUsed !== null && item.intervalKm) fractions.push(kmUsed / item.intervalKm)
  if (daysUsed !== null && daysTotal) fractions.push(daysUsed / daysTotal)
  const overshoot = fractions.length ? Math.max(...fractions) : null
  const progress = overshoot === null ? null : Math.min(1, overshoot)

  // Atenção também quando já passou de 80% do intervalo (km ou prazo), mesmo faltando mais
  // que os limites fixos de SOON_KM/SOON_DAYS (ex.: intervalo de 20.000 km).
  if (level === 'ok' && progress !== null && progress >= SOON_PROGRESS) level = 'soon'

  return {
    item, lastKm, lastDate, nextKm, nextDate, kmLeft, daysLeft,
    kmUsed, daysUsed, daysTotal, progress, overshoot, level,
  }
}

const ORDER: Record<PlanLevel, number> = { overdue: 0, soon: 1, ok: 2, unknown: 3 }

export function planStatuses(
  items: PlanItem[],
  maintenance: MaintenanceRecord[],
  curKm: number,
  todayIso: string,
): PlanStatus[] {
  return items
    .map((i) => planStatus(i, maintenance, curKm, todayIso))
    // Vencidos, próximos, em dia, sem registro; dentro de cada grupo, o mais perto de vencer primeiro.
    .sort((a, b) => ORDER[a.level] - ORDER[b.level] || (b.overshoot ?? 0) - (a.overshoot ?? 0))
}
