import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Field, KmInput, LevelBadge, PageTitle } from '../components/ui'
import { DEFAULT_PLAN, db, type PlanItem } from '../db'
import { fmtDate, fmtKm, fmtNumber, plural, today, toNum } from '../lib/format'
import { planStatuses, type PlanStatus } from '../lib/plan'
import { currentKm } from '../lib/stats'
import { useCarData } from '../lib/useCarData'

export default function Plan() {
  const data = useCarData()
  const [adding, setAdding] = useState(false)
  if (!data) return null

  const km = currentKm(data)
  const statuses = planStatuses(data.plan, data.maintenance, km, today())

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Plano de manutenção</h1>
        <Link to="/plano/novo" className="btn min-h-11 !py-2">
          + Item
        </Link>
      </div>
      <Link to="/precos" className="card mb-4 flex items-center justify-between">
        <span className="font-medium">💲 Preços de peças e serviços</span>
        <span className="text-sm font-medium text-sky-700 dark:text-sky-400">Pesquisar →</span>
      </Link>

      {statuses.length === 0 ? (
        <div className="card space-y-3 text-center">
          <p className="text-slate-600 dark:text-slate-300">
            Nenhum item ainda. Você pode começar com uma lista padrão (óleo, filtros,
            correia etc.) e ajustar os intervalos depois.
          </p>
          <button
            className="btn"
            disabled={adding}
            onClick={async () => {
              setAdding(true)
              await db.plan.bulkAdd(DEFAULT_PLAN.map((p) => ({ ...p })))
            }}
          >
            {adding ? 'Adicionando…' : 'Adicionar itens padrão'}
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {statuses.map((s) => (
            <li key={s.item.id} className="card">
              <Link to={`/plano/${s.item.id}`} className="block">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{s.item.name}</div>
                  <LevelBadge level={s.level} />
                </div>
                <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  A cada{' '}
                  {[
                    s.item.intervalKm ? fmtKm(s.item.intervalKm) : null,
                    s.item.intervalMonths ? plural(s.item.intervalMonths, 'mês', 'meses') : null,
                  ]
                    .filter(Boolean)
                    .join(' ou ')}
                </div>
                {s.progress !== null && <ProgressBar status={s} />}
                <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                  {s.lastDate || s.lastKm !== null
                    ? `Último: ${[s.lastDate ? fmtDate(s.lastDate) : null, s.lastKm !== null ? fmtKm(s.lastKm) : null]
                        .filter(Boolean)
                        .join(' · ')}`
                    : 'Sem registro anterior'}
                  {s.nextKm !== null && ` · próximo: ${fmtKm(s.nextKm)}`}
                  {s.nextDate && ` · até ${fmtDate(s.nextDate)}`}
                </div>
              </Link>
              <div className="mt-3 flex gap-2">
                <Link
                  to={`/registrar/manutencao?item=${s.item.id}`}
                  className="btn-secondary min-h-11 flex-1 !py-2 text-sm"
                >
                  Registrar troca
                </Link>
                <Link
                  to={`/precos?q=${encodeURIComponent(s.item.name)}`}
                  className="btn-secondary min-h-11 flex-1 !py-2 text-sm"
                >
                  Ver preços
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const BAR_COLOR = {
  ok: 'bg-emerald-600',
  soon: 'bg-amber-500',
  overdue: 'bg-red-600',
  unknown: 'bg-slate-400',
} as const

/** Quanto do intervalo já foi usado: ex. "6.500 / 8.000 km". */
function ProgressBar({ status: s }: { status: PlanStatus }) {
  const pct = Math.round((s.progress ?? 0) * 100)
  const parts: string[] = []
  if (s.kmUsed !== null && s.item.intervalKm)
    parts.push(`${fmtNumber(s.kmUsed)} / ${fmtNumber(s.item.intervalKm)} km`)
  if (s.daysUsed !== null && s.daysTotal)
    parts.push(`${s.daysUsed} / ${plural(s.daysTotal, 'dia', 'dias')}`)
  return (
    <div className="mt-2">
      <div
        role="progressbar"
        aria-label={`${s.item.name}: ${pct}% do intervalo usado`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
      >
        <div
          className={`h-full rounded-full ${BAR_COLOR[s.level]}`}
          style={{ width: `${Math.max(pct, 3)}%` }}
        />
      </div>
      <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">{parts.join(' · ')}</div>
    </div>
  )
}

export function PlanItemForm() {
  const { id } = useParams()
  const editId = id && id !== 'novo' ? Number(id) : undefined
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [intervalKm, setIntervalKm] = useState('')
  const [intervalMonths, setIntervalMonths] = useState('')
  const [lastKm, setLastKm] = useState('')
  const [lastDate, setLastDate] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (editId === undefined) return
    db.plan.get(editId).then((p) => {
      if (!p) return
      setName(p.name)
      setIntervalKm(p.intervalKm?.toString() ?? '')
      setIntervalMonths(p.intervalMonths?.toString() ?? '')
      setLastKm(p.lastKm?.toString() ?? '')
      setLastDate(p.lastDate ?? '')
    })
  }, [editId])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const ik = toNum(intervalKm)
    const im = toNum(intervalMonths)
    if (!name.trim() || (ik === null && im === null)) {
      setError('Informe um nome e pelo menos um intervalo (km ou meses).')
      return
    }
    if ((ik !== null && ik <= 0) || (im !== null && (!Number.isInteger(im) || im <= 0))) {
      setError('Os intervalos precisam ser maiores que zero, e os meses devem ser um número inteiro.')
      return
    }
    const row: PlanItem = {
      name: name.trim(),
      intervalKm: ik,
      intervalMonths: im,
      lastKm: toNum(lastKm),
      lastDate: lastDate || null,
    }
    if (editId) await db.plan.put({ ...row, id: editId })
    else await db.plan.add(row)
    navigate('/plano')
  }

  async function remove() {
    if (!editId) return
    if (!confirm('Excluir este item do plano? Os serviços já registrados continuam no histórico.')) return
    await db.plan.delete(editId)
    navigate('/plano')
  }

  return (
    <div>
      <PageTitle>{editId ? 'Editar item' : 'Novo item do plano'}</PageTitle>
      <form onSubmit={submit} className="card space-y-3">
        <Field label="Nome">
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Troca de óleo" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Repetir a cada (km)">
            <KmInput value={intervalKm} onChange={setIntervalKm} />
          </Field>
          <Field label="ou a cada (meses)">
            <input className="input" type="number" inputMode="numeric" min={0} value={intervalMonths} onChange={(e) => setIntervalMonths(e.target.value)} />
          </Field>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Vale o que vencer primeiro. Deixe um deles vazio se não se aplica.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Última vez (km)">
            <KmInput value={lastKm} onChange={setLastKm} />
          </Field>
          <Field label="Última vez (data)">
            <input className="input" type="date" max={today()} value={lastDate}onChange={(e) => setLastDate(e.target.value)} />
          </Field>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Opcional: use para informar quando foi feito antes de começar a usar o app. Serviços registrados depois substituem esses valores.
        </p>
        {error && (
          <p role="alert" className="rounded-lg bg-red-100 p-2 text-sm text-red-800 dark:bg-red-900/40 dark:text-red-200">
            {error}
          </p>
        )}
        <button className="btn w-full" type="submit">
          Salvar
        </button>
        {editId && (
          <button className="btn-secondary w-full !text-red-700 dark:!text-red-300" type="button" onClick={remove}>
            Excluir item
          </button>
        )}
      </form>
    </div>
  )
}
