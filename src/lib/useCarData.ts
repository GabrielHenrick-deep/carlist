import { useLiveQuery } from 'dexie-react-hooks'
import { db, type PlanItem } from '../db'
import type { CarData } from './stats'

export interface AppData extends CarData {
  plan: PlanItem[]
}

/** Todos os dados do app, atualizados automaticamente. `undefined` enquanto carrega. */
export function useCarData(): AppData | undefined {
  return useLiveQuery(async () => {
    const [car, odometer, fuel, maintenance, expenses, plan] = await Promise.all([
      db.car.get(1),
      db.odometer.toArray(),
      db.fuel.toArray(),
      db.maintenance.toArray(),
      db.expenses.toArray(),
      db.plan.toArray(),
    ])
    return { car, odometer, fuel, maintenance, expenses, plan }
  }, [])
}
