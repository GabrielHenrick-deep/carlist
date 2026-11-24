import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Field, KmInput, PageTitle } from '../components/ui'
import {
  db,
  EXPENSE_CATEGORIES,
  type Car,
  type Expense,
  type FuelEntry,
  type MaintenanceRecord,
  type OdometerReading,
} from '../db'
import { fmtDate, fmtKm, fmtMoney, today, toNum } from '../lib/format'
import { currentKm, kmBounds } from '../lib/stats'
import { showToast } from '../lib/toast'
import { useCarData, type AppData } from '../lib/useCarData'

const TYPES = [
  { key: 'abastecimento', label: 'Abastecer', icon: '⛽' },
  { key: 'manutencao', label: 'Manutenção', icon: '🔧' },
  { key: 'gasto', label: 'Gasto', icon: '💸' },

] as const

type TypeKey = (typeof TYPES)[number]['key']

// 'km' não é uma aba do "Novo": a atualização rápida fica na Home. A rota
// continua existindo para editar uma leitura de km pelo Histórico.
function isType(s: string | undefined): s is TypeKey | 'km' {
  return s === 'km' || TYPES.some((t) => t.key === s)
}

export default function Registrar() {
  const { tipo, id } = useParams()
  const data = useCarData()
  const editId = id ? Number(id) : undefined

  if (!data) return null
  if (!data.car) {
    return (
      <div className="card text-center">
        <p>Cadastre o carro antes de registrar.</p>
        <Link to="/carro" className="btn mt-3">
          Cadastrar carro
        </Link>
      </div>
    )
  }
  const type: TypeKey | 'km' = isType(tipo) ? tipo : 'abastecimento'

  const rowsOfType = {
    abastecimento: data.fuel,
    manutencao: data.maintenance,
    gasto: data.expenses,
    km: data.odometer,
  }[type]
  if (editId !== undefined && !rowsOfType.some((r) => r.id === editId)) {
    return (
      <div className="card space-y-3 text-center">
        <p>Esse registro não existe mais (talvez tenha sido excluído).</p>
        <Link to="/historico" className="btn">
          Voltar ao histórico
        </Link>
      </div>
    )
  }

  return (
    <div>
      <PageTitle>{editId ? 'Editar registro' : 'Novo registro'}</PageTitle>
      {!editId && (
        <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-slate-200 p-1 dark:bg-slate-800" role="group" aria-label="Tipo de registro">
          {TYPES.map((t) => (
            <Link
              key={t.key}
              to={`/registrar/${t.key}`}
              replace
              aria-current={t.key === type ? 'page' : undefined}
              className={`flex min-h-12 flex-col items-center justify-center rounded-lg px-1 py-1.5 text-center text-xs font-medium ${
                t.key === type
                  ? 'bg-white shadow dark:bg-slate-600'
                  : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              <span aria-hidden="true" className="text-base leading-5">
                {t.icon}
              </span>
              {t.label}
            </Link>
          ))}
        </div>
      )}
      {type === 'abastecimento' && <FuelForm car={data.car} data={data} editId={editId} />}
      {type === 'manutencao' && <MaintenanceForm data={data} editId={editId} />}
      {type === 'gasto' && <ExpenseForm editId={editId} />}
      {type === 'km' && <OdometerForm data={data} editId={editId} />}
    </div>
  )
}

/* ---------- peças compartilhadas ---------- */

/** Salvar com estado de carregamento, erro visível, aviso (toast) e retorno à tela anterior. */
function useSaver(editId?: number) {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function run(save: () => Promise<unknown>, message: string) {
    setSaving(true)
    setError('')
    try {
      await save()
      showToast(message)
      navigate(editId ? '/historico' : '/')
    } catch {
      setError('Não foi possível salvar. Tente novamente.')
      setSaving(false)
    }
  }
  return { saving, error, setError, run }
}

function FormActions({
  onDelete,
  saving,
  error,
}: {
  onDelete?: () => void
  saving: boolean
  error?: string
}) {
  return (
    <>
      {error && (
        <p role="alert" className="rounded-lg bg-red-100 p-2 text-sm text-red-800 dark:bg-red-900/40 dark:text-red-200">
          {error}
        </p>
      )}
      <div className="sticky bottom-[5.25rem] -mx-4 bg-white/95 px-4 py-3 backdrop-blur dark:bg-slate-800/95">
        <button className="btn w-full" type="submit" disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
      {onDelete && (
        <button
          className="btn-secondary w-full !text-red-700 dark:!text-red-300"
          type="button"
          onClick={() => {
            if (confirm('Excluir este registro?')) onDelete()
          }}
        >
          Excluir registro
        </button>
      )}
    </>
  )
}

/**
 * Confere o km contra os registros vizinhos NO TEMPO: ao editar um registro antigo, o que
 * importa é o km de antes e de depois dele, não o km de hoje.
 */
function KmHint({
  km,
  date,
  data,
  self,
}: {
  km: number | null
  date: string
  data: AppData
  self?: { kind: 'fuel' | 'maintenance' | 'odometer'; id: number }
}) {
  const { prev, next } = kmBounds(data, date, self)
  const at = (p: { km: number; date: string }) => (p.date ? `${fmtKm(p.km)}, ${fmtDate(p.date)}` : fmtKm(p.km))
  const warn = 'font-medium text-amber-700 dark:text-amber-300'
  if (km !== null && prev && km < prev.km)
    return <span className={warn}>Menor que um km anterior a esta data ({at(prev)}). Confira se está certo.</span>
  if (km !== null && next && km > next.km)
    return <span className={warn}>Maior que um km registrado depois desta data ({at(next)}). Confira se está certo.</span>
  if (self) {
    if (prev && next) return <span>Entre {at(prev)} e {at(next)}</span>
    if (prev) return <span>Anterior: {at(prev)}</span>
    if (next) return <span>Posterior: {at(next)}</span>
    return null
  }
  return <span>Km atual: {fmtKm(currentKm(data))}</span>
}

/** Carrega o registro em edição e preenche o formulário uma única vez. */
function useEditLoad<T>(
  table: { get(id: number): Promise<T | undefined> },
  editId: number | undefined,
  apply: (row: T) => void,
) {
  useEffect(() => {
    if (editId === undefined) return
    let cancelled = false
    table.get(editId).then((row) => {
      if (row && !cancelled) apply(row)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId])
}

/* ---------- abastecimento ---------- */

type FuelField = 'l' | 'p' | 't'

function FuelForm({
  car,
  data,
  editId,
}: {
  car: Car
  data: AppData
  editId?: number
}) {
  const navigate = useNavigate()
  const cur = currentKm(data)
  const fuelOptions =
    car.fuel === 'flex'
      ? ['Gasolina', 'Etanol']
      : [car.fuel.charAt(0).toUpperCase() + car.fuel.slice(1)]

  const [date, setDate] = useState(today())
  const [km, setKm] = useState(!editId && cur ? String(cur) : '')
  const [liters, setLiters] = useState('')
  const [price, setPrice] = useState('')
  const [total, setTotal] = useState('')
  const [fullTank, setFullTank] = useState(true)
  const [fuelType, setFuelType] = useState(fuelOptions[0])
  const [station, setStation] = useState('')
  // Os dois campos de litros/preço/total editados mais recentemente (o mais novo primeiro).
  const [order, setOrder] = useState<FuelField[]>([])
  const { saving, error, setError, run } = useSaver(editId)

  useEditLoad<FuelEntry>(db.fuel, editId, (f) => {
    setDate(f.date)
    setKm(String(f.km))
    setLiters(String(f.liters))
    setPrice(String(f.pricePerLiter))
    setTotal(String(f.total))
    setOrder(['t', 'l']) // ao editar, o preço/litro é o campo recalculado
    setFullTank(f.fullTank)
    setFuelType(f.fuelType)
    setStation(f.station)
  })

  // Litros × R$/litro = Total: preencha quaisquer dois e o terceiro é calculado.
  const values = { l: liters, p: price, t: total }
  const setters = { l: setLiters, p: setPrice, t: setTotal }
  const computed: FuelField | null =
    order.length === 2 ? (['l', 'p', 't'] as const).find((f) => !order.includes(f))! : null

  function editField(field: FuelField, v: string) {
    const next = { ...values, [field]: v }
    const ord = [field, ...order.filter((f) => f !== field)].slice(0, 2)
    setOrder(ord)
    setters[field](v)
    if (ord.length < 2) return
    const third = (['l', 'p', 't'] as const).find((f) => !ord.includes(f))!
    const l = toNum(next.l)
    const p = toNum(next.p)
    const t = toNum(next.t)
    let res: number | null = null
    if (third === 't' && l !== null && p !== null) res = l * p
    else if (third === 'p' && l && t !== null) res = t / l
    else if (third === 'l' && p && t !== null) res = t / p
    setters[third](res === null || !Number.isFinite(res) ? '' : String(Number(res.toFixed(third === 'p' ? 3 : 2))))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const kmN = toNum(km)
    const l = toNum(liters)
    const t = toNum(total)
    if (kmN === null || !l || l <= 0 || t === null) {
      setError('Preencha o km e dois destes três: litros, preço por litro ou total.')
      return
    }
    const row: FuelEntry = {
      date,
      km: kmN,
      liters: l,
      pricePerLiter: toNum(price) ?? t / l,
      total: t,
      fullTank,
      fuelType,
      station: station.trim(),
    }
    await run(
      () => (editId ? db.fuel.put({ ...row, id: editId }) : db.fuel.add(row)),
      `Abastecimento salvo · ${fmtMoney(t)}`,
    )
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <Field label="Data">
        <input className="input" type="date" required max={today()} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Km do carro" hint={undefined}>
        <KmInput required value={km} onChange={setKm} />
        <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          <KmHint km={toNum(km)} date={date} data={data} self={editId ? { kind: 'fuel', id: editId } : undefined} />
        </div>
      </Field>
      {fuelOptions.length > 1 && (
        <Field label="Combustível">
          <select className="input" value={fuelType} onChange={(e) => setFuelType(e.target.value)}>
            {fuelOptions.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Litros" hint={computed === 'l' ? 'calculado' : undefined}>
          <input className="input" type="number" inputMode="decimal" step="any" min={0} max={9999999} value={liters} onChange={(e) => editField('l', e.target.value)} />
        </Field>
        <Field label="R$/litro" hint={computed === 'p' ? 'calculado' : undefined}>
          <input className="input" type="number" inputMode="decimal" step="any" min={0} max={9999999} value={price} onChange={(e) => editField('p', e.target.value)} />
        </Field>
        <div className="col-span-2">
          <Field label="Total (R$)" hint={computed === 't' ? 'calculado' : 'Preencha quaisquer dois campos: o terceiro é calculado.'}>
            <input className="input" type="number" inputMode="decimal" step="any" min={0} max={9999999} value={total} onChange={(e) => editField('t', e.target.value)} />
          </Field>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-5 w-5" checked={fullTank} onChange={(e) => setFullTank(e.target.checked)} />
        Encheu o tanque (necessário para calcular o consumo)
      </label>
      <Field label="Posto (opcional)">
        <input className="input" value={station} onChange={(e) => setStation(e.target.value)} />
      </Field>
      <FormActions
        saving={saving}
        error={error}
        onDelete={editId ? async () => { await db.fuel.delete(editId); navigate('/historico') } : undefined}
      />
    </form>
  )
}

/* ---------- manutenção ---------- */

function MaintenanceForm({ data, editId }: { data: AppData; editId?: number }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const cur = currentKm(data)

  const preItem = Number(params.get('item')) || undefined
  const preName = data.plan.find((p) => p.id === preItem)?.name

  const [date, setDate] = useState(today())
  const [km, setKm] = useState(cur ? String(cur) : '')
  const [title, setTitle] = useState(preName ?? '')
  const [cost, setCost] = useState('')
  const [shop, setShop] = useState('')
  const [notes, setNotes] = useState('')
  const [planIds, setPlanIds] = useState<number[]>(preItem ? [preItem] : [])
  // Itens marcados automaticamente pelo nome (não pelos botões), para poder desmarcar se o nome mudar.
  const [autoIds, setAutoIds] = useState<number[]>([])
  const { saving, error, setError, run } = useSaver(editId)

  useEditLoad<MaintenanceRecord>(db.maintenance, editId, (m) => {
    setDate(m.date)
    setKm(String(m.km))
    setTitle(m.title)
    setCost(String(m.cost))
    setShop(m.shop)
    setNotes(m.notes)
    setPlanIds(m.planItemIds)
  })

  const namesOf = (ids: number[]) =>
    data.plan
      .filter((p) => p.id !== undefined && ids.includes(p.id))
      .map((p) => p.name)
      .join(', ')

  function togglePlan(id: number) {
    const next = planIds.includes(id)
      ? planIds.filter((i) => i !== id)
      : [...planIds, id]
    // Sugere o título a partir dos itens marcados, se o usuário ainda não digitou um próprio.
    if (title === '' || title === namesOf(planIds)) setTitle(namesOf(next))
    setPlanIds(next)
    setAutoIds(autoIds.filter((i) => i !== id))
  }

  // Ao terminar de digitar (ou escolher na lista) o nome exato de um item do plano, ele é marcado
  // como feito. Só depois do campo perder o foco, para "Filtro de ar" digitado a caminho de
  // "Filtro de ar-condicionado" não marcar o item errado. Se o nome mudar depois, a marca automática sai.
  function syncPlanWithTitle() {
    const hit = data.plan.find((p) => p.id !== undefined && p.name.trim().toLowerCase() === title.trim().toLowerCase())
    const hitId = hit?.id
    const keep = planIds.filter((id) => !autoIds.includes(id) || id === hitId)
    if (hitId !== undefined && !keep.includes(hitId)) {
      setPlanIds([...keep, hitId])
      setAutoIds([hitId])
    } else {
      setPlanIds(keep)
      setAutoIds(autoIds.filter((id) => id === hitId))
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const kmN = toNum(km)
    if (kmN === null || !title.trim()) {
      setError('Informe o km e a descrição do serviço.')
      return
    }
    const row: MaintenanceRecord = {
      date,
      km: kmN,
      title: title.trim(),
      cost: toNum(cost) ?? 0,
      shop: shop.trim(),
      notes: notes.trim(),
      planItemIds: planIds,
    }
    await run(
      () => (editId ? db.maintenance.put({ ...row, id: editId }) : db.maintenance.add(row)),
      'Manutenção salva',
    )
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Data">
          <input className="input" type="date" required max={today()} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Km do carro">
          <KmInput required value={km} onChange={setKm} />
        </Field>
      </div>
      <div className="-mt-2 text-xs text-slate-600 dark:text-slate-400">
        <KmHint km={toNum(km)} date={date} data={data} self={editId ? { kind: 'maintenance', id: editId } : undefined} />
      </div>

      {data.plan.length > 0 && (
        <div>
          <span className="label">O que foi feito do plano (opcional)</span>
          <div className="flex flex-wrap gap-2">
            {data.plan.map((p) => {
              const on = p.id !== undefined && planIds.includes(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => p.id !== undefined && togglePlan(p.id)}
                  className={`min-h-11 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ${
                    on
                      ? 'bg-sky-700 text-white ring-sky-700'
                      : 'bg-white text-slate-700 ring-slate-300 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-600'
                  }`}
                >
                  {on ? '✓ ' : ''}
                  {p.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <Field label="Descrição do serviço">
        <input
          className="input"
          required
          list="plan-names"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={syncPlanWithTitle}
          placeholder="Ex.: Troca de óleo e filtro"
        />
        <datalist id="plan-names">
          {data.plan.map((p) => (
            <option key={p.id} value={p.name} />
          ))}
        </datalist>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Valor (R$)">
          <input className="input" type="number" inputMode="decimal" step="any" min={0} max={9999999} value={cost} onChange={(e) => setCost(e.target.value)} />
        </Field>
        <Field label="Oficina (opcional)">
          <input className="input" value={shop} onChange={(e) => setShop(e.target.value)} />
        </Field>
      </div>
      <Field label="Observações (opcional)">
        <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <FormActions
        saving={saving}
        error={error}
        onDelete={editId ? async () => { await db.maintenance.delete(editId); navigate('/historico') } : undefined}
      />
    </form>
  )
}

/* ---------- gasto geral ---------- */

function ExpenseForm({ editId }: { editId?: number }) {
  const navigate = useNavigate()
  const [date, setDate] = useState(today())
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0])
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const { saving, error, setError, run } = useSaver(editId)

  useEditLoad<Expense>(db.expenses, editId, (x) => {
    setDate(x.date)
    setCategory(x.category)
    setAmount(String(x.amount))
    setNotes(x.notes)
  })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const a = toNum(amount)
    if (a === null) {
      setError('Informe o valor do gasto.')
      return
    }
    const row: Expense = { date, category, amount: a, notes: notes.trim() }
    await run(
      () => (editId ? db.expenses.put({ ...row, id: editId }) : db.expenses.add(row)),
      `Gasto salvo · ${fmtMoney(a)}`,
    )
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <Field label="Data">
        <input className="input" type="date" required max={today()} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Categoria">
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </Field>
      <Field label="Valor (R$)">
        <input className="input" type="number" inputMode="decimal" step="any" required min={0} max={9999999} value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <Field label="Observações (opcional)">
        <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <FormActions
        saving={saving}
        error={error}
        onDelete={editId ? async () => { await db.expenses.delete(editId); navigate('/historico') } : undefined}
      />
    </form>
  )
}

/* ---------- km ---------- */

function OdometerForm({ data, editId }: { data: AppData; editId?: number }) {
  const navigate = useNavigate()
  const cur = currentKm(data)
  const [date, setDate] = useState(today())
  const [km, setKm] = useState('')
  const { saving, error, setError, run } = useSaver(editId)

  useEditLoad<OdometerReading>(db.odometer, editId, (o) => {
    setDate(o.date)
    setKm(String(o.km))
  })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const kmN = toNum(km)
    if (kmN === null) {
      setError('Informe o km do carro.')
      return
    }
    if (!editId && kmN < cur) {
      setError(`A nova quilometragem (${fmtKm(kmN)}) não pode ser menor que a atual (${fmtKm(cur)}).`)
      return
    }
    await run(
      () => (editId ? db.odometer.put({ date, km: kmN, id: editId }) : db.odometer.add({ date, km: kmN })),
      'Km atualizado',
    )
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <Field label="Data">
        <input className="input" type="date" required max={today()} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Km do carro">
        <KmInput required value={km} onChange={setKm} />
        <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          <KmHint km={toNum(km)} date={date} data={data} self={editId ? { kind: 'odometer', id: editId } : undefined} />
        </div>
      </Field>
      <FormActions
        saving={saving}
        error={error}
        onDelete={editId ? async () => { await db.odometer.delete(editId); navigate('/historico') } : undefined}
      />
    </form>
  )
}
