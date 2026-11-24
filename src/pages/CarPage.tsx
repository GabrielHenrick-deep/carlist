import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Field, KmInput, PageTitle } from '../components/ui'
import { db, type Car, type FuelKind } from '../db'
import { eraseAll, exportBackup, getLastBackup, importBackup } from '../lib/backup'
import { fmtDate, toNum } from '../lib/format'
import { isIOS, useFullscreen, useInstall } from '../lib/pwa'
import { showToast } from '../lib/toast'
import { useCarData } from '../lib/useCarData'

const FUELS: { value: FuelKind; label: string }[] = [
  { value: 'flex', label: 'Flex (gasolina/etanol)' },
  { value: 'gasolina', label: 'Gasolina' },
  { value: 'etanol', label: 'Etanol' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'gnv', label: 'GNV' },
  { value: 'eletrico', label: 'Elétrico' },
]

export default function CarPage() {
  const data = useCarData()
  if (!data) return null

  return (
    <div className="space-y-6">
      {/* A chave acompanha o carro salvo: importar ou apagar dados recria o formulário já atualizado. */}
      <CarForm key={JSON.stringify(data.car ?? null)} car={data.car} />
      <AppSection />
      <BackupSection />
    </div>
  )
}

function AppSection() {
  const { canInstall, installed, install } = useInstall()
  const fullscreen = useFullscreen()

  return (
    <section className="card space-y-3">
      <h2 className="text-lg font-semibold">Aplicativo</h2>
      {installed ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          ✔ App instalado neste aparelho.
        </p>
      ) : canInstall ? (
        <button className="btn w-full" onClick={install}>
          Instalar na tela inicial
        </button>
      ) : isIOS() ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          No iPhone: toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>.
        </p>
      ) : (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Para instalar, abra o app pelo Chrome com endereço seguro (HTTPS) e use o menu ⋮ →
          <b> Instalar app</b>.
        </p>
      )}
      {fullscreen.supported ? (
        <button className="btn-secondary w-full" onClick={fullscreen.toggle}>
          {fullscreen.active ? 'Sair da tela cheia' : 'Entrar em tela cheia'}
        </button>
      ) : (
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Este navegador não permite tela cheia. Instalando o app, ele abre sem a barra do navegador.
        </p>
      )}
    </section>
  )
}

function CarForm({ car }: { car: Car | undefined }) {
  const navigate = useNavigate()
  const isNew = !car
  const [name, setName] = useState(car?.name ?? '')
  const [plate, setPlate] = useState(car?.plate ?? '')
  const [make, setMake] = useState(car?.make ?? '')
  const [model, setModel] = useState(car?.model ?? '')
  const [year, setYear] = useState(car?.year?.toString() ?? '')
  const [fuel, setFuel] = useState<FuelKind>(car?.fuel ?? 'flex')
  const [initialKm, setInitialKm] = useState(car ? String(car.initialKm) : '')
  const [error, setError] = useState('')

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!make.trim() || !model.trim()) {
      setError('Informe a marca e o modelo do carro.')
      return
    }
    setError('')
    await db.car.put({
      id: 1,
      name: name.trim(),
      plate: plate.trim().toUpperCase(),
      make: make.trim(),
      model: model.trim(),
      year: toNum(year),
      fuel,
      initialKm: toNum(initialKm) ?? 0,
    })
    if (isNew) navigate('/')
    else showToast('Carro salvo')
  }

  return (
    <div>
      <PageTitle>{isNew ? 'Cadastrar carro' : 'Meu carro'}</PageTitle>
      <form onSubmit={save} className="card space-y-3">
        <Field label="Apelido (opcional)">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Meu Gol" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Marca">
            <input className="input" required value={make} onChange={(e) => setMake(e.target.value)} />
          </Field>
          <Field label="Modelo">
            <input className="input" required value={model} onChange={(e) => setModel(e.target.value)} />
          </Field>
          <Field label="Ano">
            <input className="input" type="number" inputMode="numeric" min={1900} max={2100} value={year} onChange={(e) => setYear(e.target.value)} />
          </Field>
          <Field label="Placa">
            <input className="input uppercase" value={plate} onChange={(e) => setPlate(e.target.value)} maxLength={8} />
          </Field>
        </div>
        <Field label="Combustível">
          <select className="input" value={fuel} onChange={(e) => setFuel(e.target.value as FuelKind)}>
            {FUELS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={isNew ? 'Km atual do carro' : 'Km inicial (ponto de partida)'}
          hint={
            isNew
              ? 'Serve de ponto de partida para o custo por km.'
              : 'Km de quando você começou a usar o app, base do custo por km. Para atualizar o km atual, use o campo na tela Início.'
          }
        >
          <KmInput required value={initialKm} onChange={setInitialKm} />
        </Field>
        <button className="btn w-full" type="submit">
          Salvar
        </button>
        {error && (
          <p role="alert" className="rounded-lg bg-red-100 p-2 text-sm text-red-800 dark:bg-red-900/40 dark:text-red-200">
            {error}
          </p>
        )}
      </form>
    </div>
  )
}

function BackupSection() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const [lastBackup, setLastBackup] = useState(getLastBackup())

  async function onExport() {
    await exportBackup()
    setLastBackup(getLastBackup())
  }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!confirm('Importar vai SUBSTITUIR todos os dados atuais pelo conteúdo do backup. Continuar?')) return
    try {
      await importBackup(file)
      setLastBackup(getLastBackup())
      setMsg('Backup importado.')
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Falha ao importar.')
    }
  }

  async function onErase() {
    if (!confirm('Apagar TODOS os dados do app neste aparelho? Isso não pode ser desfeito.')) return
    if (!confirm('Tem certeza? Faça um backup antes se ainda não fez.')) return
    await eraseAll()
    navigate('/')
  }

  return (
    <section className="card space-y-3">
      <h2 className="text-lg font-semibold">Backup dos dados</h2>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Seus dados ficam apenas neste aparelho. Se você limpar os dados do navegador ou trocar de
        celular, eles se perdem — exporte um backup de tempos em tempos e guarde no Drive.
      </p>
      <p className="text-xs text-slate-600 dark:text-slate-400">
        Último backup: {lastBackup ? fmtDate(lastBackup) : 'nunca'}
      </p>
      <div className="flex gap-2">
        <button className="btn flex-1" onClick={onExport}>
          Exportar
        </button>
        <button className="btn-secondary flex-1" onClick={() => fileRef.current?.click()}>
          Importar
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onImport} />
      </div>
      {msg && (
        <p role="status" className="text-center text-sm text-slate-700 dark:text-slate-300">
          {msg}
        </p>
      )}
      <button className="min-h-11 w-full text-sm text-red-700 underline dark:text-red-300" onClick={onErase}>
        Apagar todos os dados
      </button>
    </section>
  )
}
