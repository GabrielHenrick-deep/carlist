import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router-dom'
import { KmInput, LevelBadge, PageTitle, Stat } from '../components/ui'
import { db } from '../db'
import { getLastBackup } from '../lib/backup'
import { showToast } from '../lib/toast'
import {
  daysBetween,
  fmtDate,
  fmtKm,
  fmtMoney,
  fmtNum,
  monthKey,
  plural,
  today,
  toNum,
} from '../lib/format'
import { planStatuses, type PlanStatus } from '../lib/plan'
import {
  averageConsumption,
  consumptionSeries,
  costPerKm,
  currentKm,
} from '../lib/stats'
import { useCarData } from '../lib/useCarData'

// Three.js (~700 KB) só é baixado quando a Home é aberta, fora do pacote principal.
const Car3D = lazy(() => import('../components/Car3D'))

function statusText(s: PlanStatus): string {
  const parts: string[] = []
  if (s.kmLeft !== null)
    parts.push(
      s.kmLeft < 0
        ? `${fmtKm(-s.kmLeft)} além do prazo`
        : s.kmLeft === 0
          ? 'chegou ao km do serviço'
          : `faltam ${fmtKm(s.kmLeft)}`,
    )
  if (s.daysLeft !== null)
    parts.push(
      s.daysLeft < 0
        ? `${plural(-s.daysLeft, 'dia', 'dias')} atrasado`
        : s.daysLeft === 0
          ? 'vence hoje'
          : `falta${s.daysLeft === 1 ? '' : 'm'} ${plural(s.daysLeft, 'dia', 'dias')}`,
    )
  return parts.join(' · ')
}

export default function Home() {
  const data = useCarData()
  const [kmInput, setKmInput] = useState('')
  const [kmError, setKmError] = useState('')

  if (!data) return null

  if (!data.car) {
    return (
      <div className="card mt-10 text-center">
        <div className="text-5xl">🚗</div>
        <h1 className="mt-3 text-xl font-bold">Bem-vindo ao CarList</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Comece cadastrando o seu carro.
        </p>
        <Link to="/carro" className="btn mt-4">
          Cadastrar carro
        </Link>
      </div>
    )
  }

  const todayIso = today()
  const km = currentKm(data)
  const statuses = planStatuses(data.plan, data.maintenance, km, todayIso)
  const alerts = statuses.filter((s) => s.level === 'overdue' || s.level === 'soon')
  const avg = averageConsumption(consumptionSeries(data.fuel))
  const perKm = costPerKm(data)

  const month = monthKey(todayIso)
  const monthSpent =
    data.fuel.filter((f) => monthKey(f.date) === month).reduce((s, f) => s + f.total, 0) +
    data.maintenance
      .filter((m) => monthKey(m.date) === month)
      .reduce((s, m) => s + m.cost, 0) +
    data.expenses
      .filter((e) => monthKey(e.date) === month)
      .reduce((s, e) => s + e.amount, 0)

  const hasData =
    data.fuel.length + data.maintenance.length + data.expenses.length > 0
  const lastBackup = getLastBackup()
  const backupAge = lastBackup ? daysBetween(lastBackup, todayIso) : null
  const needsBackup = hasData && (backupAge === null || backupAge > 30)

  async function saveKm(e: React.FormEvent) {
    e.preventDefault()
    const v = toNum(kmInput)
    if (v === null) {
      setKmError('Digite a quilometragem atual do carro.')
      return
    }
    if (v < km) {
      setKmError(`A nova quilometragem (${fmtKm(v)}) não pode ser menor que a atual (${fmtKm(km)}).`)
      return
    }
    if (v === km) {
      setKmError('Esse já é o km atual.')
      return
    }
    await db.odometer.add({ date: todayIso, km: v })
    setKmInput('')
    setKmError('')
    showToast(`Km atualizado · ${fmtKm(v)}`)
  }

  return (
    <div className="space-y-4">
      <PageTitle>{data.car.name || `${data.car.make} ${data.car.model}`}</PageTitle>

      <div className="card overflow-hidden !p-0 bg-gradient-to-b from-slate-200 to-slate-50 dark:from-slate-700 dark:to-slate-800">
        <Suspense fallback={<div className="h-56" />}>
          <Car3D className="h-56 sm:h-72" />
        </Suspense>
      </div>

      {needsBackup && (
        <Link
          to="/carro"
          className="block rounded-xl bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
        >
          ⚠️ {backupAge === null ? 'Você ainda não fez backup.' : `Último backup há ${backupAge} dias.`}{' '}
          Os dados ficam só neste aparelho — toque para exportar.
        </Link>
      )}

      <div className="card">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">
          Quilometragem atual
        </div>
        <div className="mt-1 text-4xl font-bold">{fmtKm(km)}</div>
        <form onSubmit={saveKm} className="mt-3 flex gap-2">
          <KmInput
            aria-label="Atualizar quilometragem"
            aria-invalid={kmError ? true : undefined}
            placeholder="Atualizar km"
            value={kmInput}
            onChange={(d) => {
              setKmInput(d)
              setKmError('')
            }}
          />
          <button className="btn" type="submit">
            Salvar
          </button>
        </form>
        {kmError && (
          <p role="alert" className="mt-2 rounded-lg bg-red-100 p-2 text-sm text-red-800 dark:bg-red-900/40 dark:text-red-200">
            {kmError}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link to="/registrar/abastecimento" className="btn !py-4 text-base">
          <span aria-hidden="true">⛽</span> Abastecer
        </Link>
        <Link to="/registrar/manutencao" className="btn-secondary !py-4 text-base">
          <span aria-hidden="true">🔧</span> Manutenção
        </Link>
      </div>

      <Link to="/analises" className="card flex min-h-11 items-center justify-between text-sm font-medium">
        <span>
          <span aria-hidden="true">📊</span> Gráficos e análises
        </span>
        <span className="text-sky-700 dark:text-sky-400">Ver →</span>
      </Link>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Manutenções próximas</h2>
          <Link to="/plano" className="inline-flex min-h-11 items-center text-sm text-sky-700 dark:text-sky-400">
            Ver plano
          </Link>
        </div>
        {alerts.length === 0 ? (
          <div className="card text-sm text-slate-600 dark:text-slate-300">
            {data.plan.length === 0
              ? 'Você ainda não tem itens no plano de manutenção.'
              : 'Nada vencendo por enquanto. 👍'}
          </div>
        ) : (
          <ul className="space-y-2">
            {alerts.map((s) => (
              <li key={s.item.id}>
                <Link
                  to={`/registrar/manutencao?item=${s.item.id}`}
                  className="card flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="font-medium">{s.item.name}</div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">{statusText(s)}</div>
                  </div>
                  <LevelBadge level={s.level} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Gasto no mês" value={fmtMoney(monthSpent)} />
        <Stat
          label="Consumo médio"
          value={avg ? `${fmtNum(avg)} km/l` : '—'}
          sub={avg ? undefined : 'precisa de 2 tanques cheios'}
        />
        <Stat label="Custo por km" value={perKm ? fmtMoney(perKm) : '—'} />
        <Stat
          label="Último abastec."
          value={
            data.fuel.length
              ? fmtDate([...data.fuel].sort((a, b) => b.date.localeCompare(a.date))[0].date)
              : '—'
          }
        />
      </div>
    </div>
  )
}
