import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageTitle, ViewTabs } from '../components/ui'
import { fmtDate, fmtKm, fmtMoney, fmtNum, monthKey } from '../lib/format'
import { consumptionSeries } from '../lib/stats'
import { useCarData } from '../lib/useCarData'

type Kind = 'abastecimento' | 'manutencao' | 'gasto' | 'km'

interface Row {
  key: string
  kind: Kind
  id: number
  date: string
  km: number | null
  title: string
  sub: string
  amount: number | null
}

const FILTERS: { key: Kind | 'todos'; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'abastecimento', label: '⛽ Abastec.' },
  { key: 'manutencao', label: '🔧 Manut.' },
  { key: 'gasto', label: '💸 Gastos' },
  { key: 'km', label: '🛣️ Km' },
]

const ICON: Record<Kind, string> = {
  abastecimento: '⛽',
  manutencao: '🔧',
  gasto: '💸',
  km: '🛣️',
}

export default function History() {
  const data = useCarData()
  const [filter, setFilter] = useState<Kind | 'todos'>('todos')
  if (!data) return null

  const kmPerL = new Map(
    consumptionSeries(data.fuel).map((p) => [p.fuelId, p.kmPerLiter]),
  )

  const rows: Row[] = [
    ...data.fuel.map((f): Row => {
      const c = kmPerL.get(f.id)
      return {
        key: `f${f.id}`,
        kind: 'abastecimento',
        id: f.id!,
        date: f.date,
        km: f.km,
        title: `${f.fuelType} · ${fmtNum(f.liters)} L`,
        sub: [
          `${fmtMoney(f.pricePerLiter)}/L`,
          f.fullTank ? undefined : 'parcial',
          c ? `${fmtNum(c)} km/l` : undefined,
          f.station || undefined,
        ]
          .filter(Boolean)
          .join(' · '),
        amount: f.total,
      }
    }),
    ...data.maintenance.map((m): Row => ({
      key: `m${m.id}`,
      kind: 'manutencao',
      id: m.id!,
      date: m.date,
      km: m.km,
      title: m.title,
      sub: [m.shop, m.notes].filter(Boolean).join(' · '),
      amount: m.cost,
    })),
    ...data.expenses.map((x): Row => ({
      key: `x${x.id}`,
      kind: 'gasto',
      id: x.id!,
      date: x.date,
      km: null,
      title: x.category,
      sub: x.notes,
      amount: x.amount,
    })),
    ...data.odometer.map((o): Row => ({
      key: `o${o.id}`,
      kind: 'km',
      id: o.id!,
      date: o.date,
      km: o.km,
      title: 'Atualização de km',
      sub: '',
      amount: null,
    })),
  ]
    .filter((r) => filter === 'todos' || r.kind === filter)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.km ?? 0) - (a.km ?? 0))

  // Agrupa por mês, já que a lista está ordenada da data mais recente para a mais antiga.
  const groups: { month: string; rows: Row[]; total: number }[] = []
  for (const r of rows) {
    const month = monthKey(r.date)
    let g = groups[groups.length - 1]
    if (!g || g.month !== month) {
      g = { month, rows: [], total: 0 }
      groups.push(g)
    }
    g.rows.push(r)
    g.total += r.amount ?? 0
  }

  return (
    <div>
      <PageTitle>Histórico</PageTitle>
      <ViewTabs active="lista" />
      <div className="mb-3 grid grid-cols-3 gap-2" role="group" aria-label="Filtrar por tipo">
        {FILTERS.map((f) => (
          <button
            type="button"
            key={f.key}
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={`min-h-11 rounded-full px-2 py-2 text-sm ${
              filter === f.key
                ? 'bg-sky-700 text-white'
                : 'bg-white ring-1 ring-slate-300 dark:bg-slate-800 dark:ring-slate-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="card space-y-3 text-center text-slate-700 dark:text-slate-300">
          <p>Nenhum registro {filter === 'todos' ? 'ainda' : 'deste tipo'}.</p>
          <Link to="/registrar/abastecimento" className="btn">
            Fazer o primeiro registro
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.month} aria-label={monthLabel(g.month)}>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {monthLabel(g.month)}
                </h2>
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {fmtMoney(g.total)}
                </span>
              </div>
              <ul className="space-y-2">
                {g.rows.map((r) => (
                  <li key={r.key}>
                    <Link
                      to={`/registrar/${r.kind}/${r.id}`}
                      className="card flex items-center gap-3"
                    >
                      <span aria-hidden="true" className="text-2xl">
                        {ICON[r.kind]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 font-medium">{r.title}</div>
                        <div className="line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
                          {fmtDate(r.date)}
                          {r.km !== null && ` · ${fmtKm(r.km)}`}
                          {r.sub && ` · ${r.sub}`}
                        </div>
                      </div>
                      {r.amount !== null && (
                        <div className="shrink-0 font-semibold">{fmtMoney(r.amount)}</div>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
    new Date(y, m - 1, 1),
  )
  return label.charAt(0).toUpperCase() + label.slice(1)
}
