import type {
  Car,
  Expense,
  FuelEntry,
  MaintenanceRecord,
  OdometerReading,
} from '../db'

export interface CarData {
  car?: Car
  odometer: OdometerReading[]
  fuel: FuelEntry[]
  maintenance: MaintenanceRecord[]
  expenses: Expense[]
}

/** Maior km conhecido entre todos os registros. */
export function currentKm(d: CarData): number {
  return Math.max(
    d.car?.initialKm ?? 0,
    ...d.odometer.map((o) => o.km),
    ...d.fuel.map((f) => f.km),
    ...d.maintenance.map((m) => m.km),
  )
}

export interface KmPoint {
  km: number
  date: string
}

/**
 * Limites de km para um registro numa data: o maior km já lido até essa data e o
 * menor km lido depois dela. `self` é o registro em edição (não conta contra ele mesmo).
 */
export function kmBounds(
  d: CarData,
  date: string,
  self?: { kind: 'fuel' | 'maintenance' | 'odometer'; id: number },
): { prev: KmPoint | null; next: KmPoint | null } {
  const pts: KmPoint[] = [
    ...d.odometer.filter((o) => !(self?.kind === 'odometer' && o.id === self.id)),
    ...d.fuel.filter((f) => !(self?.kind === 'fuel' && f.id === self.id)),
    ...d.maintenance.filter((m) => !(self?.kind === 'maintenance' && m.id === self.id)),
  ].map((p) => ({ km: p.km, date: p.date }))

  let prev: KmPoint | null = null
  let next: KmPoint | null = null
  for (const p of pts) {
    if (p.date <= date) {
      if (!prev || p.km > prev.km) prev = p
    } else if (!next || p.km < next.km) next = p
  }
  // Registro novo: o km de partida do carro também é um piso.
  if (!self && d.car && (!prev || d.car.initialKm > prev.km)) prev = { km: d.car.initialKm, date: '' }
  return { prev, next }
}

export interface ConsumptionPoint {
  fuelId: number | undefined
  date: string
  km: number
  kmPerLiter: number
}

/**
 * Consumo (km/l) pelo método do tanque cheio: entre dois abastecimentos de
 * tanque cheio, soma os litros abastecidos depois do primeiro (inclusive os
 * parciais) e divide pela distância percorrida.
 */
export function consumptionSeries(fuel: FuelEntry[]): ConsumptionPoint[] {
  const sorted = [...fuel].sort((a, b) => a.km - b.km)
  const points: ConsumptionPoint[] = []
  let lastFullKm: number | null = null
  let liters = 0

  for (const e of sorted) {
    if (lastFullKm !== null) liters += e.liters
    if (e.fullTank) {
      if (lastFullKm !== null && liters > 0 && e.km > lastFullKm) {
        points.push({
          fuelId: e.id,
          date: e.date,
          km: e.km,
          kmPerLiter: (e.km - lastFullKm) / liters,
        })
      }
      lastFullKm = e.km
      liters = 0
    }
  }
  return points
}

export function averageConsumption(points: ConsumptionPoint[]): number | null {
  if (points.length === 0) return null
  return points.reduce((s, p) => s + p.kmPerLiter, 0) / points.length
}

export function totalSpent(d: CarData): number {
  return (
    d.fuel.reduce((s, f) => s + f.total, 0) +
    d.maintenance.reduce((s, m) => s + m.cost, 0) +
    d.expenses.reduce((s, e) => s + e.amount, 0)
  )
}

/** Custo por km rodado desde o km inicial cadastrado. */
export function costPerKm(d: CarData): number | null {
  const driven = currentKm(d) - (d.car?.initialKm ?? 0)
  if (driven <= 0) return null
  return totalSpent(d) / driven
}
