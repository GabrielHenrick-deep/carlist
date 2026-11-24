import { lazy, Suspense, useEffect } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { requestPersistentStorage } from './lib/backup'
import CarPage from './pages/CarPage'
import History from './pages/History'
import Home from './pages/Home'
import Plan, { PlanItemForm } from './pages/Plan'
import Precos from './pages/Precos'
import Registrar from './pages/Registrar'

// Recharts só é baixado ao abrir as Análises.
const Analises = lazy(() => import('./pages/Analises'))

export default function App() {
  useEffect(() => {
    void requestPersistentStorage()
    // Começa a carregar o modelo 3D já na abertura do app, em qualquer tela: assim ele está
    // pronto quando você voltar para a Início, mesmo que saia dela antes de terminar de baixar.
    const t = setTimeout(() => {
      void import('./lib/carViewer').then((m) => m.getCarViewer())
    }, 300)
    return () => clearTimeout(t)
  }, [])

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="historico" element={<History />} />
          <Route path="registrar/:tipo?/:id?" element={<Registrar />} />
          <Route
            path="analises"
            element={
              <Suspense fallback={<div className="card text-center text-slate-600">Carregando gráficos…</div>}>
                <Analises />
              </Suspense>
            }
          />
          <Route path="plano" element={<Plan />} />
          <Route path="plano/:id" element={<PlanItemForm />} />
          <Route path="precos" element={<Precos />} />
          <Route path="carro"element={<CarPage />} />
          <Route path="*" element={<Home />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
