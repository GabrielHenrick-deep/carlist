import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageTitle, ViewTabs } from '../components/ui'
import { fmtDate, fmtMoney, fmtNum, fmtNumber, today } from '../lib/format'
import {
  ethanolVerdict,
  fuelStats,
  monthlySpending,
  priceSeries,
  type FuelStats,
} from '../lib/analytics'
import { useCarData } from '../lib/useCarData'

const AXIS_TICK = { fill: 'var(--viz-ink-2)', fontSize: 12 }
const pct = (v: number) => `${Math.round(v * 100)}%`
// Inteiro com milhar ("R$ 1.050"): cabe numa linha e não arredonda o valor.
const axisMoney = (v: number) => `R$ ${fmtNumber(Math.round(v))}`

const SPEND_SERIES = [
  { key: 'combustivel', name: 'Combustível', color: 'var(--series-1)' },
  { key: 'manutencao', name: 'Manutenção', color: 'var(--series-2)' },
  { key: 'outros', name: 'Impostos e outros', color: 'var(--series-3)' },
] as const

/** A cor segue a entidade (o combustível), não a posição na lista. */
const FUEL_COLOR: Record<string, string> = {
  Gasolina: 'var(--series-1)',
  Etanol: 'var(--series-3)',
}
const fuelColor = (t: string) => FUEL_COLOR[t] ?? 'var(--series-2)'

function ChartCard({
  title,
  subtitle,
  legend,
  children,
  table,
}: {
  title: string
  subtitle?: string
  legend?: { name: string; color: string }[]
  children: ReactNode
  table: ReactNode
}) {
  return (
    <section className="card viz">
      <h2 className="text-lg font-semibold">{title}</h2>
      {subtitle && (
        <p className="text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>
      )}
      {legend && legend.length > 1 && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700 dark:text-slate-300">
          {legend.map((l) => (
            <li key={l.name} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-3 w-3 rounded-sm"
                style={{ background: l.color }}
              />
              {l.name}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3">{children}</div>
      <details className="mt-3 text-sm">
        <summary className="min-h-11 cursor-pointer py-2 text-sky-700 dark:text-sky-400">
          Ver como tabela
        </summary>
        <div className="overflow-x-auto">{table}</div>
      </details>
    </section>
  )
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-slate-200 dark:border-slate-700">
          {head.map((h) => (
            <th key={h} className="py-1.5 pr-3 font-medium text-slate-600 dark:text-slate-400">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-slate-100 dark:border-slate-700/50">
            {r.map((c, j) => (
              <td key={j} className="py-1.5 pr-3">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

interface TipItem {
  name?: string | number
  value?: number | string
  color?: string
}

function Tip({
  active,
  payload,
  label,
  total,
  format = fmtMoney,
}: {
  active?: boolean
  payload?: readonly TipItem[]
  label?: string | number
  total?: boolean
  format?: (v: number) => string
}) {
  if (!active || !payload?.length) return null
  const items = payload.filter((p) => typeof p.value === 'number')
  const sum = items.reduce((s, p) => s + (p.value as number), 0)
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-lg dark:border-slate-600 dark:bg-slate-800">
      <div className="mb-1 font-medium">{label}</div>
      {items.map((p) => (
        <div key={String(p.name)} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
            <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-semibold">{format(p.value as number)}</span>
        </div>
      ))}
      {total && items.length > 1 && (
        <div className="mt-1 flex justify-between border-t border-slate-200 pt-1 dark:border-slate-600">
          <span className="text-slate-700 dark:text-slate-300">Total</span>
          <span className="font-semibold">{format(sum)}</span>
        </div>
      )}
    </div>
  )
}

export default function Analises() {
  const data = useCarData()
  const [months, setMonths] = useState<6 | 12>(6)
  if (!data) return null

  const hasAnything = data.fuel.length + data.maintenance.length + data.expenses.length > 0
  const spending = monthlySpending(data, months, today())
  const periodTotal = spending.reduce((s, m) => s + m.total, 0)
  const monthsWithSpend = spending.filter((m) => m.total > 0).length
  const { points, types } = priceSeries(data.fuel)
  const stats = fuelStats(data.fuel)
  const verdict = ethanolVerdict(stats)
  const isFlex = data.car?.fuel === 'flex'

  return (
    <div className="space-y-4">
      <PageTitle>Histórico</PageTitle>
      <ViewTabs active="analises" />

      {!hasAnything ? (
        <div className="card space-y-3 text-center text-slate-700 dark:text-slate-300">
          <p>Os gráficos aparecem assim que você fizer os primeiros registros.</p>
          <Link to="/registrar/abastecimento" className="btn">
            Fazer o primeiro registro
          </Link>
        </div>
      ) : (
        <>
          <div role="group" aria-label="Período" className="flex gap-2">
            {([6, 12] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={months === m}
                onClick={() => setMonths(m)}
                className={`min-h-11 rounded-full px-4 text-sm ${
                  months === m
                    ? 'bg-sky-700 text-white'
                    : 'bg-white ring-1 ring-slate-300 dark:bg-slate-800 dark:ring-slate-600'
                }`}
              >
                {m} meses
              </button>
            ))}
          </div>

          <ChartCard
            title="Gastos por mês"
            subtitle={`${fmtMoney(periodTotal)} no período${
              monthsWithSpend ? ` · média ${fmtMoney(periodTotal / monthsWithSpend)} por mês com gasto` : ''
            }`}
            legend={SPEND_SERIES.map((s) => ({ name: s.name, color: s.color }))}
            table={
              <Table
                head={['Mês', 'Combustível', 'Manutenção', 'Impostos e outros', 'Total']}
                rows={spending.map((m) => [
                  m.label,
                  fmtMoney(m.combustivel),
                  fmtMoney(m.manutencao),
                  fmtMoney(m.outros),
                  fmtMoney(m.total),
                ])}
              />
            }
          >
            <div
              role="img"
              aria-label={`Gráfico de barras empilhadas com os gastos dos últimos ${months} meses, total de ${fmtMoney(periodTotal)}. Há uma tabela abaixo.`}
              className="h-60"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={spending} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
                  <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: 'var(--viz-axis)' }} interval={0} tickFormatter={(l: string) => (months === 12 ? l.slice(0, 3) : l)} />
                  <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={68} tickFormatter={axisMoney} />
                  <Tooltip cursor={{ fill: 'var(--viz-grid)', opacity: 0.4 }} content={<Tip total />} />
                  {SPEND_SERIES.map((s, i) => (
                    <Bar
                      key={s.key}
                      dataKey={s.key}
                      name={s.name}
                      stackId="gastos"
                      fill={s.color}
                      stroke="var(--viz-surface)"
                      strokeWidth={2}
                      maxBarSize={32}
                      radius={i === SPEND_SERIES.length - 1 ? [4, 4, 0, 0] : 0}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          {points.length > 0 && (
            <ChartCard
              title="Preço do litro"
              subtitle="Quanto você pagou em cada abastecimento"
              legend={types.map((t) => ({ name: t, color: fuelColor(t) }))}
              table={
                <Table
                  head={['Data', 'Combustível', 'R$/litro']}
                  rows={[...data.fuel]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((f) => [fmtDate(f.date), f.fuelType, fmtMoney(f.pricePerLiter)])}
                />
              }
            >
              <div
                role="img"
                aria-label={`Gráfico de linhas do preço do litro em ${points.length} abastecimentos. Há uma tabela abaixo.`}
                className="h-56"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
                    <XAxis
                      dataKey="date"
                      tick={AXIS_TICK}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--viz-axis)' }}
                      interval="preserveStartEnd"
                      padding={{ left: 24, right: 24 }}
                      minTickGap={32}
                      tickFormatter={(d: string) => `${d.slice(8)}/${d.slice(5, 7)}`}
                    />
                    <YAxis
                      tick={AXIS_TICK}
                      tickLine={false}
                      axisLine={false}
                      width={56}
                      domain={['auto', 'auto']}
                      tickFormatter={(v: number) => fmtMoney(v)}
                    />
                    <Tooltip
                      offset={20}
                      content={(p) => (
                        <Tip
                          active={p.active}
                          payload={p.payload as readonly TipItem[]}
                          label={typeof p.label === 'string' ? fmtDate(p.label) : p.label}
                        />
                      )}
                    />
                    {types.map((t) => (
                      <Line
                        key={t}
                        type="monotone"
                        dataKey={t}
                        name={t}
                        stroke={fuelColor(t)}
                        strokeWidth={2}
                        connectNulls
                        dot={{ r: 4, stroke: 'var(--viz-surface)', strokeWidth: 2, fill: fuelColor(t) }}
                        activeDot={{ r: 6, stroke: 'var(--viz-surface)', strokeWidth: 2 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          )}

          {isFlex && <EthanolCard stats={stats} verdict={verdict} />}
        </>
      )}
    </div>
  )
}

function EthanolCard({
  stats,
  verdict,
}: {
  stats: FuelStats[]
  verdict: ReturnType<typeof ethanolVerdict>
}) {
  const e = stats.find((s) => s.type === 'Etanol')
  const g = stats.find((s) => s.type === 'Gasolina')

  return (
    <section className="card">
      <h2 className="text-lg font-semibold">Gasolina ou etanol?</h2>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Calculado com o consumo real do seu carro, não com a regra genérica dos 70%.
      </p>

      {!verdict ? (
        <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
          Para comparar, preciso de trechos medidos (entre dois tanques cheios) com cada combustível.{' '}
          {g && e
            ? `Trechos medidos até agora: gasolina ${g.samples}, etanol ${e.samples}.`
            : `Ainda falta registrar ${!g && !e ? 'abastecimentos de gasolina e de etanol' : !g ? 'gasolina' : 'etanol'}.`}
        </p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {[g!, e!].map((s) => {
              const win = verdict.better === s.type
              return (
                <div
                  key={s.type}
                  className={`rounded-xl p-3 ring-1 ${
                    win
                      ? 'bg-emerald-50 ring-emerald-600 dark:bg-emerald-900/30'
                      : 'ring-slate-200 dark:ring-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-sm font-medium">
                    {s.type}
                    {win && <span className="text-emerald-800 dark:text-emerald-300">✔ compensa</span>}
                  </div>
                  <div className="mt-1 break-words text-xl font-bold min-[360px]:text-2xl">{fmtMoney(s.costPerKm!)}/km</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    {fmtNum(s.kmPerLiter!)} km/l · {fmtMoney(s.lastPrice!)}/L
                  </div>
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
            {verdict.better === 'empate'
              ? 'Os dois custam praticamente o mesmo por km agora.'
              : `${verdict.better} está saindo cerca de ${Math.round(verdict.savingPct)}% mais barato por km.`}{' '}
            Neste carro o etanol rende <b>{pct(verdict.realRatio)}</b> da gasolina; ele compensa quando custa
            menos de {pct(verdict.realRatio)} do preço dela. Hoje está em <b>{pct(verdict.priceRatio)}</b>.
          </p>
        </>
      )}
    </section>
  )
}
