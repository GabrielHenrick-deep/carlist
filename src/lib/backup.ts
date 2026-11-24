import { db } from '../db'
import { today } from './format'

const LAST_BACKUP_KEY = 'carlist:lastBackup'
const FORMAT_VERSION = 1

export function getLastBackup(): string | null {
  try {
    return localStorage.getItem(LAST_BACKUP_KEY)
  } catch {
    return null
  }
}

function setLastBackup(iso: string) {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, iso)
  } catch {
    /* sem localStorage: só perde o lembrete */
  }
}

export async function exportBackup(): Promise<void> {
  const data = {
    app: 'carlist',
    version: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    car: await db.car.toArray(),
    odometer: await db.odometer.toArray(),
    fuel: await db.fuel.toArray(),
    maintenance: await db.maintenance.toArray(),
    expenses: await db.expenses.toArray(),
    plan: await db.plan.toArray(),
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `carlist-backup-${today()}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  setLastBackup(today())
}

type Row = Record<string, unknown>

const isStr = (v: unknown): v is string => typeof v === 'string'
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isDate = (v: unknown): v is string => isStr(v) && /^\d{4}-\d{2}-\d{2}$/.test(v)
const isNumOrNull = (v: unknown) => v === null || isNum(v)
const isDateOrNull = (v: unknown) => v === null || isDate(v)

/** Confere o formato de cada linha, para um arquivo adulterado ou antigo não quebrar o app depois. */
const VALIDATORS: Record<string, (r: Row) => boolean> = {
  car: (r) =>
    isNum(r.id) && isStr(r.name) && isStr(r.plate) && isStr(r.make) && isStr(r.model) &&
    isNumOrNull(r.year) && isStr(r.fuel) && isNum(r.initialKm),
  odometer: (r) => isDate(r.date) && isNum(r.km),
  fuel: (r) =>
    isDate(r.date) && isNum(r.km) && isNum(r.liters) && isNum(r.pricePerLiter) && isNum(r.total) &&
    typeof r.fullTank === 'boolean' && isStr(r.fuelType) && isStr(r.station),
  maintenance: (r) =>
    isDate(r.date) && isNum(r.km) && isStr(r.title) && isNum(r.cost) && isStr(r.shop) &&
    isStr(r.notes) && Array.isArray(r.planItemIds) && r.planItemIds.every(isNum),
  expenses: (r) => isDate(r.date) && isStr(r.category) && isNum(r.amount) && isStr(r.notes),
  plan: (r) =>
    isStr(r.name) && isNumOrNull(r.intervalKm) && isNumOrNull(r.intervalMonths) &&
    isNumOrNull(r.lastKm) && isDateOrNull(r.lastDate),
}

/** Substitui TODOS os dados atuais pelo conteúdo do arquivo de backup. */
export async function importBackup(file: File): Promise<void> {
  let data: Record<string, unknown>
  try {
    data = JSON.parse(await file.text())
  } catch {
    throw new Error('O arquivo não é um JSON válido.')
  }
  if (!data || typeof data !== 'object' || data.app !== 'carlist' || data.version !== FORMAT_VERSION) {
    throw new Error('Este arquivo não é um backup do CarList.')
  }
  const tables = ['car', 'odometer', 'fuel', 'maintenance', 'expenses', 'plan'] as const
  for (const t of tables) {
    const rows = data[t]
    if (!Array.isArray(rows)) throw new Error(`Backup inválido: falta "${t}".`)
    if (!rows.every((r) => r && typeof r === 'object' && VALIDATORS[t](r as Row)))
      throw new Error(`Backup inválido: há registros com dados inesperados em "${t}". Nada foi importado.`)
  }

  await db.transaction(
    'rw',
    [db.car, db.odometer, db.fuel, db.maintenance, db.expenses, db.plan],
    async () => {
      await Promise.all(tables.map((t) => db[t].clear()))
      await db.car.bulkPut(data.car as never[])
      await db.odometer.bulkPut(data.odometer as never[])
      await db.fuel.bulkPut(data.fuel as never[])
      await db.maintenance.bulkPut(data.maintenance as never[])
      await db.expenses.bulkPut(data.expenses as never[])
      await db.plan.bulkPut(data.plan as never[])
    },
  )
  setLastBackup(today())
}

export async function eraseAll(): Promise<void> {
  await Promise.all(
    [db.car, db.odometer, db.fuel, db.maintenance, db.expenses, db.plan].map((t) =>
      t.clear(),
    ),
  )
}

export async function requestPersistentStorage(): Promise<void> {
  try {
    await navigator.storage?.persist?.()
  } catch {
    /* ignora */
  }
}
