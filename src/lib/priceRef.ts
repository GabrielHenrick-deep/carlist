import type { Car, MaintenanceRecord } from '../db'

/**
 * Preços de referência para o Gol G5 (1.0/1.6 8V), coletados em anúncios e guias
 * online em nov/2026. São ordens de grandeza, NÃO cotações: variam por marca, região
 * e loja. O app é offline, então o preço "ao vivo" vem dos links de busca.
 * Itens sem faixa só têm os links de busca e a média do próprio histórico.
 */
export const REF_DATE = 'nov/2026'

export interface Range {
  min: number
  max: number
}

export interface PriceRef {
  key: string
  name: string
  /** Texto usado na busca (acrescido de marca, modelo e ano). */
  search: string
  /** Palavras (sem acento, minúsculas) para achar este item no seu histórico. */
  keywords: string[]
  /** Se o título do serviço tiver alguma destas palavras, NÃO conta para este item. */
  exclude?: string[]
  parts?: Range
  /** Serviço completo (peça + mão de obra), quando há referência. */
  service?: Range
  note?: string
}

const r = (min: number, max = min): Range => ({ min, max })

export const PRICE_REFS: PriceRef[] = [
  {
    key: 'oleo',
    name: 'Troca de óleo e filtro',
    search: 'kit troca de óleo e filtro',
    keywords: ['oleo'],
    exclude: ['cambio', 'diferencial', 'freio', 'direcao'],
    parts: r(269, 338),
    service: r(400),
    note: 'Kit óleo + filtro; serviço completo estimado por guia de custos.',
  },
  {
    key: 'filtro-ar',
    name: 'Filtro de ar do motor',
    search: 'filtro de ar do motor',
    keywords: ['filtro de ar'],
    exclude: ['cabine', 'condicionado', 'oleo', 'combustivel'],
    parts: r(38),
  },
  {
    key: 'filtro-comb',
    name: 'Filtro de combustível',
    search: 'filtro de combustível',
    keywords: ['filtro de combustivel', 'filtro combustivel'],
    parts: r(20, 56),
  },
  {
    key: 'filtro-cabine',
    name: 'Filtro de cabine (ar-condicionado)',
    search: 'filtro de cabine ar condicionado',
    keywords: ['filtro de cabine', 'filtro do ar condicionado', 'filtro de ar condicionado'],
  },
  {
    key: 'velas',
    name: 'Velas e cabos de ignição',
    search: 'jogo de velas e cabos de ignição',
    keywords: ['vela', 'cabos de ignicao'],
    parts: r(266, 296),
    note: 'Jogo de cabos + velas NGK.',
  },
  {
    key: 'pastilhas',
    name: 'Pastilhas de freio',
    search: 'kit pastilha de freio dianteira',
    keywords: ['pastilha'],
    service: r(180),
    note: 'Serviço de troca a partir de ~R$ 180 em centro automotivo (peça pode ser extra).',
  },
  {
    key: 'discos',
    name: 'Discos de freio',
    search: 'par disco de freio dianteiro',
    keywords: ['disco de freio', 'discos de freio'],
  },
  {
    key: 'correia',
    name: 'Correia dentada e tensor',
    search: 'kit correia dentada e tensor',
    keywords: ['correia dentada', 'correia'],
    exclude: ['alternador', 'acessorios', 'servo'],
    parts: r(113, 124),
    note: 'Só o kit; a mão de obra é à parte.',
  },
  {
    key: 'amort-diant',
    name: 'Amortecedores dianteiros',
    search: 'kit amortecedor dianteiro',
    keywords: ['amortecedor dianteiro', 'amortecedores dianteiros'],
    parts: r(571),
  },
  {
    key: 'amort-tras',
    name: 'Amortecedores traseiros (par)',
    search: 'par amortecedor traseiro',
    keywords: ['amortecedor traseiro', 'amortecedores traseiros'],
    parts: r(342),
  },
  {
    key: 'revisao',
    name: 'Revisão básica (óleo, filtros, inspeção)',
    search: 'kit revisão',
    keywords: ['revisao'],
    exclude: ['pastilha', 'bateria', 'vela', 'pneu', 'freio', 'arrefecimento', 'correia'],
    service: r(380, 700),
    note: 'Guia de carros populares 1.0: ~R$ 380 no mecânico, ~R$ 700 na concessionária.',
  },
  { key: 'bateria', name: 'Bateria', search: 'bateria 60ah', keywords: ['bateria'] },
  { key: 'pneus', name: 'Pneus', search: 'pneu aro 14', keywords: ['pneu'] },
  { key: 'fluido-freio', name: 'Fluido de freio', search: 'fluido de freio dot 4', keywords: ['fluido de freio'] },
  { key: 'embreagem', name: 'Kit de embreagem', search: 'kit embreagem', keywords: ['embreagem'] },
  {
    key: 'alinhamento',
    name: 'Alinhamento e balanceamento',
    search: 'alinhamento e balanceamento',
    keywords: ['alinhamento', 'balanceamento'],
  },
]

export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[-_]+/g, ' ')
    .trim()

export const carLabel = (car: Car | undefined) =>
  car ? [car.make, car.model, car.year].filter(Boolean).join(' ') : ''

/** Só o Gol G5 (e primos de plataforma) é coberto pela tabela de referência. */
export const isCovered = (car: Car | undefined) => /\b(gol|voyage|saveiro|fox)\b/i.test(car?.model ?? '')

/** O Gol G5 é de 2008 a 2013; de outras gerações, os valores podem variar bastante. */
export const isOtherGeneration = (car: Car | undefined) =>
  !!car?.year && (car.year < 2008 || car.year > 2013)

export function searchLinks(ref: string, car: Car | undefined) {
  const q = [ref, car?.make, car?.model, car?.year].filter(Boolean).join(' ')
  const slug = norm(q).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return {
    ml: `https://lista.mercadolivre.com.br/${slug}`,
    google: `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(q)}`,
  }
}

export interface HistoryAvg {
  avg: number
  count: number
  last: number
}

/** Média do que VOCÊ pagou: só serviços de um único item, para não misturar notas combinadas. */
export function historyAvg(ref: PriceRef, maintenance: MaintenanceRecord[]): HistoryAvg | null {
  const hits = maintenance
    .filter((m) => {
      const t = norm(m.title)
      return (
        m.cost > 0 &&
        m.planItemIds.length <= 1 &&
        ref.keywords.some((k) => t.includes(k)) &&
        !ref.exclude?.some((x) => t.includes(x))
      )
    })
    .sort((a, b) => b.date.localeCompare(a.date))
  if (!hits.length) return null
  return { avg: hits.reduce((s, m) => s + m.cost, 0) / hits.length, count: hits.length, last: hits[0].cost }
}

const STOP = new Set(['de', 'do', 'da', 'dos', 'das', 'e', 'o', 'a', 'para', 'com', 'em'])
const words = (s: string) =>
  norm(s)
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))

// "pastilhas" casa com "pastilha"; palavras curtas (ar, km) só casam inteiras.
const sameWord = (a: string, b: string) =>
  a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)))

/**
 * Filtra a lista por palavras (não pelo texto inteiro) e ordena do mais ao menos parecido.
 * Basta casar metade das palavras digitadas, para "Pastilhas de freio (revisão)" achar as pastilhas.
 */
export function searchRefs(query: string, refs: PriceRef[]): PriceRef[] {
  const q = words(query)
  if (q.length === 0) return refs
  const need = Math.ceil(q.length / 2)
  return refs
    .map((r) => {
      const pool = words([r.name, r.search, ...r.keywords].join(' '))
      const nameWords = words(r.name)
      const score = q.filter((t) => pool.some((w) => sameWord(t, w))).length
      return { r, score, extra: nameWords.length }
    })
    .filter((x) => x.score >= need)
    .sort((a, b) => b.score - a.score || a.extra - b.extra)
    .map((x) => x.r)
}
