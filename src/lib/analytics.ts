import type { FuelEntry } from '../db'
import { monthKey } from './format'
import type { CarData } from './stats'

/* ---------- gastos por mês ---------- */

export interface MonthSpending {
  month: string // YYYY-MM
  label: string // "nov/26"
  combustivel: number
  manutencao: number
  outros: number
  total: number
}

const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return `${MONTHS_PT[m - 1]}/${String(y).slice(2)}`
}

/** Últimos `months` meses até `todayIso`, incluindo meses sem gasto (barra vazia). */
export function monthlySpending(d: CarData, months: number, todayIso: string): MonthSpending[] {
  const [ty, tm] = todayIso.split('-').map(Number)
  const rows = new Map<string, MonthSpending>()
  for (let i = months - 1; i >= 0; i--) {
    const dt = new Date(ty, tm - 1 - i, 1)
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
    rows.set(key, { month: key, label: monthLabel(key), combustivel: 0, manutencao: 0, outros: 0, total: 0 })
  }
  const add = (date: string, field: 'combustivel' | 'manutencao' | 'outros', v: number) => {
    const r = rows.get(monthKey(date))
    if (!r) return
    r[field] += v
    r.total += v
  }
  d.fuel.forEach((f) => add(f.date, 'combustivel', f.total))
  d.maintenance.forEach((m) => add(m.date, 'manutencao', m.cost))
  d.expenses.forEach((e) => add(e.date, 'outros', e.amount))
  return [...rows.values()]
}

/* ---------- preço do litro ao longo do tempo ---------- */

export interface PricePoint {
  date: string
  [fuelType: string]: number | string | undefined
}

export function priceSeries(fuel: FuelEntry[]): { points: PricePoint[]; types: string[] } {
  const sorted = [...fuel].sort((a, b) => a.date.localeCompare(b.date) || a.km - b.km)
  const types = [...new Set(sorted.map((f) => f.fuelType))]
  const points = sorted.map((f) => ({ date: f.date, [f.fuelType]: f.pricePerLiter }) as PricePoint)
  return { points, types }
}

/* ---------- gasolina x etanol com o consumo real do carro ---------- */

export interface FuelStats {
  type: string
  kmPerLiter: number | null // média ponderada (km totais / litros totais)
  samples: number // trechos medidos com esse combustível
  lastPrice: number | null
  costPerKm: number | null
}

/**
 * Consumo por combustível, pelo método do tanque cheio. Só entram os trechos
 * (entre dois tanques cheios) abastecidos com UM único combustível: trechos
 * misturados não dá para atribuir.
 */
export function fuelStats(fuel: FuelEntry[]): FuelStats[] {
  const sorted = [...fuel].sort((a, b) => a.km - b.km)
  const acc = new Map<string, { km: number; liters: number; samples: number }>()

  // O trecho entre dois tanques cheios foi percorrido com o combustível que estava no tanque,
  // ou seja, o do abastecimento que ABRE o trecho (e dos parciais no meio). O abastecimento que
  // fecha o trecho só repõe o que foi gasto e vale para o trecho seguinte.
  let baseKm: number | null = null
  let liters = 0
  let types = new Set<string>()
  for (const e of sorted) {
    if (baseKm !== null) {
      liters += e.liters
      if (!e.fullTank) types.add(e.fuelType)
    }
    if (e.fullTank) {
      if (baseKm !== null && liters > 0 && e.km > baseKm && types.size === 1) {
        const t = [...types][0]
        const a = acc.get(t) ?? { km: 0, liters: 0, samples: 0 }
        a.km += e.km - baseKm
        a.liters += liters
        a.samples += 1
        acc.set(t, a)
      }
      baseKm = e.km
      liters = 0
      types = new Set([e.fuelType])
    }
  }

  const lastPrice = new Map<string, number>()
  ;[...fuel]
    .sort((a, b) => a.date.localeCompare(b.date) || a.km - b.km)
    .forEach((f) => lastPrice.set(f.fuelType, f.pricePerLiter))

  return [...new Set(fuel.map((f) => f.fuelType))].map((type) => {
    const a = acc.get(type)
    const kmPerLiter = a && a.liters > 0 ? a.km / a.liters : null
    const price = lastPrice.get(type) ?? null
    return {
      type,
      kmPerLiter,
      samples: a?.samples ?? 0,
      lastPrice: price,
      costPerKm: kmPerLiter && price ? price / kmPerLiter : null,
    }
  })
}

export interface EthanolVerdict {
  better: 'Etanol' | 'Gasolina' | 'empate'
  /** Etanol rende x% da gasolina neste carro (ex.: 0.71). */
  realRatio: number
  /** Preço do etanol / preço da gasolina hoje (ex.: 0.68). */
  priceRatio: number
  savingPct: number // economia por km do combustível vencedor, em %
}

export function ethanolVerdict(stats: FuelStats[]): EthanolVerdict | null {
  const e = stats.find((s) => s.type === 'Etanol')
  const g = stats.find((s) => s.type === 'Gasolina')
  if (!e || !g || !e.kmPerLiter || !g.kmPerLiter || !e.lastPrice || !g.lastPrice) return null
  const ce = e.costPerKm!
  const cg = g.costPerKm!
  const diff = Math.abs(ce - cg) / Math.max(ce, cg)
  return {
    better: diff < 0.02 ? 'empate' : ce < cg ? 'Etanol' : 'Gasolina',
    realRatio: e.kmPerLiter / g.kmPerLiter,
    priceRatio: e.lastPrice / g.lastPrice,
    savingPct: diff * 100,
  }
}
