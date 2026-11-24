import Dexie, { type EntityTable } from 'dexie'

export type FuelKind =
  | 'flex'
  | 'gasolina'
  | 'etanol'
  | 'diesel'
  | 'gnv'
  | 'eletrico'

export interface Car {
  id: number // sempre 1: o app controla um único carro
  name: string
  plate: string
  make: string
  model: string
  year: number | null
  fuel: FuelKind
  initialKm: number
}

/** Atualização manual do odômetro. */
export interface OdometerReading {
  id?: number
  date: string // YYYY-MM-DD
  km: number
}

export interface FuelEntry {
  id?: number
  date: string
  km: number
  liters: number
  pricePerLiter: number
  total: number
  fullTank: boolean
  fuelType: string
  station: string
}

export interface MaintenanceRecord {
  id?: number
  date: string
  km: number
  title: string
  cost: number
  shop: string
  notes: string
  /** Itens do plano de manutenção que foram feitos nesse serviço. */
  planItemIds: number[]
}

export const EXPENSE_CATEGORIES = [
  'IPVA',
  'Seguro',
  'Licenciamento',
  'Multa',
  'Estacionamento',
  'Pedágio',
  'Lavagem',
  'Acessórios',
  'Outros',
] as const

export interface Expense {
  id?: number
  date: string
  category: string
  amount: number
  notes: string
}

export interface PlanItem {
  id?: number
  name: string
  intervalKm: number | null
  intervalMonths: number | null
  /** Última vez feito antes de usar o app (opcional). */
  lastKm: number | null
  lastDate: string | null
}

export type CarListDB = Dexie & {
  car: EntityTable<Car, 'id'>
  odometer: EntityTable<OdometerReading, 'id'>
  fuel: EntityTable<FuelEntry, 'id'>
  maintenance: EntityTable<MaintenanceRecord, 'id'>
  expenses: EntityTable<Expense, 'id'>
  plan: EntityTable<PlanItem, 'id'>
}

export const db = new Dexie('carlist') as CarListDB

db.version(1).stores({
  car: 'id',
  odometer: '++id, date, km',
  fuel: '++id, date, km',
  maintenance: '++id, date, km',
  expenses: '++id, date, category',
  plan: '++id',
})

export const DEFAULT_PLAN: Omit<PlanItem, 'id'>[] = [
  { name: 'Troca de óleo e filtro de óleo', intervalKm: 10000, intervalMonths: 12 },
  { name: 'Filtro de ar', intervalKm: 15000, intervalMonths: 12 },
  { name: 'Filtro de ar-condicionado (cabine)', intervalKm: 15000, intervalMonths: 12 },
  { name: 'Filtro de combustível', intervalKm: 20000, intervalMonths: 24 },
  { name: 'Velas de ignição', intervalKm: 30000, intervalMonths: null },
  { name: 'Fluido de freio', intervalKm: null, intervalMonths: 24 },
  { name: 'Líquido de arrefecimento', intervalKm: null, intervalMonths: 24 },
  { name: 'Alinhamento e balanceamento', intervalKm: 10000, intervalMonths: 12 },
  { name: 'Rodízio de pneus', intervalKm: 10000, intervalMonths: null },
  { name: 'Pastilhas de freio (revisão)', intervalKm: 30000, intervalMonths: null },
  { name: 'Correia dentada', intervalKm: 60000, intervalMonths: 48 },
  { name: 'Bateria (revisão)', intervalKm: null, intervalMonths: 36 },
].map((i) => ({ ...i, lastKm: null, lastDate: null }))
