import type { InputHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { PlanLevel } from '../lib/plan'

export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-600 dark:text-slate-400">{hint}</span>}
    </label>
  )
}

export function Stat({
  label,
  value,
  sub,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
}) {
  return (
    <div className="card">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-1 break-words text-xl font-bold min-[360px]:text-2xl">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{sub}</div>}
    </div>
  )
}

const levelStyle: Record<PlanLevel, string> = {
  overdue: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  soon: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  ok: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  unknown: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
}
const levelLabel: Record<PlanLevel, string> = {
  overdue: 'Vencido',
  soon: 'Em breve',
  ok: 'Em dia',
  unknown: 'Sem registro',
}

export function LevelBadge({ level }: { level: PlanLevel }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${levelStyle[level]}`}
    >
      {levelLabel[level]}
    </span>
  )
}

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="mb-4 text-2xl font-bold">{children}</h1>
}

/**
 * Campo de quilometragem: aceita só dígitos e mostra o separador de milhar
 * (136000 → "136.000"). Assim "136.000" nunca é lido como 136 km.
 * `value` e `onChange` trabalham com a string só de dígitos.
 */
export function KmInput({
  value,
  onChange,
  className = 'input',
  ...rest
}: {
  value: string
  onChange: (digits: string) => void
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>) {
  const shown = value === '' ? '' : Number(value).toLocaleString('pt-BR')
  return (
    <input
      {...rest}
      className={className}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={shown}
      onFocus={(e) => e.target.select()}
      onChange={(e) =>
        onChange(e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 7))
      }
    />
  )
}

/** Alterna entre a lista do Histórico e as Análises (gráficos). */
export function ViewTabs({ active }: { active: 'lista' | 'analises' }) {
  const items = [
    { key: 'lista', to: '/historico', label: 'Lista' },
    { key: 'analises', to: '/analises', label: 'Análises' },
  ] as const
  return (
    <div
      role="group"
      aria-label="Modo de visualização"
      className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-200 p-1 dark:bg-slate-800"
    >
      {items.map((i) => (
        <Link
          key={i.key}
          to={i.to}
          replace
          aria-current={i.key === active ? 'page' : undefined}
          className={`flex min-h-11 items-center justify-center rounded-lg text-sm font-medium ${
            i.key === active
              ? 'bg-white shadow dark:bg-slate-600'
              : 'text-slate-700 dark:text-slate-300'
          }`}
        >
          {i.label}
        </Link>
      ))}
    </div>
  )
}
