import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageTitle } from '../components/ui'
import { fmtMoney } from '../lib/format'
import {
  carLabel,
  historyAvg,
  isCovered,
  isOtherGeneration,
  norm,
  PRICE_REFS,
  REF_DATE,
  searchLinks,
  searchRefs,
  type PriceRef,
  type Range,
} from '../lib/priceRef'
import { useCarData } from '../lib/useCarData'

const RECENT_KEY = 'carlist.priceSearches'

function loadRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 8) : []
  } catch {
    return []
  }
}

const range = (r: Range) => (r.min === r.max ? `≈ ${fmtMoney(r.min)}` : `${fmtMoney(r.min)} a ${fmtMoney(r.max)}`)

export default function Precos() {
  const data = useCarData()
  const [params] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [recent, setRecent] = useState(loadRecent)
  if (!data) return null

  // Guarda a pesquisa ao abrir a busca externa, para repetir com um toque depois.
  function remember(term: string) {
    const t = term.trim()
    if (!t) return
    const next = [t, ...recent.filter((r) => norm(r) !== norm(t))].slice(0, 8)
    setRecent(next)
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next))
    } catch {
      /* sem armazenamento: só não lembra */
    }
  }

  const car = data.car
  const label = carLabel(car)
  const covered = isCovered(car)
  const refs = searchRefs(query, PRICE_REFS)
  const custom = query.trim() ? searchLinks(query.trim(), car) : null

  return (
    <div className="space-y-4">
      <PageTitle>Preços de peças e serviços</PageTitle>

      <p className="text-sm text-slate-700 dark:text-slate-300">
        {label ? (
          <>
            Pesquisa pensada para o seu <b>{label}</b>.{' '}
          </>
        ) : null}
        Os valores abaixo são <b>aproximados</b> (anúncios e guias online, {REF_DATE}) e servem como
        ordem de grandeza. Para o preço de hoje, use os botões de busca: eles já abrem a pesquisa com
        o modelo do carro.
      </p>

      {!car && (
        <p role="note" className="rounded-lg bg-amber-100 p-2 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
          Cadastre o carro (aba Carro) para ver as faixas de preço e ter as buscas com o modelo dele.
        </p>
      )}

      {car && covered && isOtherGeneration(car) && (
        <p role="note" className="rounded-lg bg-amber-100 p-2 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
          As faixas são do Gol G5 (2008 a 2013). Para o seu {label}, os valores podem variar: confirme nas buscas.
        </p>
      )}

      {car && !covered && (
        <p role="note" className="rounded-lg bg-amber-100 p-2 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
          A tabela de referência é do VW Gol G5. Para o {label}, use as buscas e a média do seu histórico.
        </p>
      )}

      <div className="card space-y-2">
        <label className="label" htmlFor="q">
          Buscar peça ou serviço
        </label>
        <input
          id="q"
          className="input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ex.: filtro de óleo, bieleta, farol"
        />
        {custom && (
          <div className="space-y-2 pt-1">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {refs.length === 0 ? 'Não tenho faixa de preço para isso. ' : ''}
              Os botões abaixo abrem a busca em outro site, já com o modelo do carro.
            </p>
            <div className="flex gap-2">
              <SearchButton href={custom.ml} onOpen={() => remember(query)}>
                Mercado Livre
              </SearchButton>
              <SearchButton href={custom.google} onOpen={() => remember(query)}>
                Google Shopping
              </SearchButton>
            </div>
          </div>
        )}
        {recent.length > 0 && (
          <div className="pt-1">
            <span className="label">Pesquisados recentemente</span>
            <div className="flex flex-wrap gap-2">
              {recent.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setQuery(r)}
                  className="min-h-9 rounded-full bg-slate-200 px-3 text-xs font-medium text-slate-800 dark:bg-slate-700 dark:text-slate-100"
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {refs.length === 0 ? (
        <p className="text-center text-sm text-slate-600 dark:text-slate-400">
          Nada na lista com esse nome. Use os botões de busca acima.
        </p>
      ) : (
        <ul className="space-y-2">
          {refs.map((p) => (
            <RefCard key={p.key} item={p} covered={covered} />
          ))}
        </ul>
      )}

      <p className="text-xs text-slate-600 dark:text-slate-400">
        Veja também o <Link to="/plano" className="inline-flex min-h-11 items-center underline">plano de manutenção</Link> para saber o que
        está perto de vencer.
      </p>
    </div>
  )
}

function SearchButton({
  href,
  children,
  onOpen,
}: {
  href: string
  children: string
  onOpen?: () => void
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onOpen}
      className="btn-secondary min-h-11 flex-1 !py-2 text-sm"
    >
      {children} ↗
    </a>
  )
}

function RefCard({ item, covered }: { item: PriceRef; covered: boolean }) {
  const data = useCarData()
  if (!data) return null
  const links = searchLinks(item.search, data.car)
  const mine = historyAvg(item, data.maintenance)
  const hasRef = covered && (item.parts || item.service)

  return (
    <li className="card space-y-2">
      <h2 className="font-semibold">{item.name}</h2>

      {hasRef ? (
        <dl className="space-y-1 text-sm">
          {item.parts && (
            <div className="flex justify-between gap-3">
              <dt className="text-slate-600 dark:text-slate-400">Peça (anúncios)</dt>
              <dd className="font-semibold">{range(item.parts)}</dd>
            </div>
          )}
          {item.service && (
            <div className="flex justify-between gap-3">
              <dt className="text-slate-600 dark:text-slate-400">Serviço</dt>
              <dd className="font-semibold">{range(item.service)}</dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="text-sm text-slate-600 dark:text-slate-400">Sem faixa de referência: use a busca.</p>
      )}
      {hasRef && item.note && <p className="text-xs text-slate-600 dark:text-slate-400">{item.note}</p>}

      {mine && (
        <p className="rounded-lg bg-sky-50 p-2 text-sm text-sky-900 dark:bg-sky-900/30 dark:text-sky-100">
          Você pagou em média <b>{fmtMoney(mine.avg)}</b> ({mine.count}{' '}
          {mine.count === 1 ? 'registro' : 'registros'}; último {fmtMoney(mine.last)}).
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <SearchButton href={links.ml}>Mercado Livre</SearchButton>
        <SearchButton href={links.google}>Google Shopping</SearchButton>
      </div>
    </li>
  )
}
