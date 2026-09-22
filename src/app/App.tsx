import { useEffect } from 'react'
import { ModelPanel } from '../components/ModelPanel'
import { ParameterPanel } from '../components/ParameterPanel'
import { getModelDefinition } from '../parametric/registry'
import { useModelStore } from '../store/modelStore'
import { Viewport } from '../viewer/Viewport'

export function App() {
  const selectedModelId = useModelStore((state) => state.selectedModelId)
  const mesh = useModelStore((state) => state.mesh)
  const status = useModelStore((state) => state.status)
  const error = useModelStore((state) => state.error)
  const initialize = useModelStore((state) => state.initialize)
  const model = getModelDefinition(selectedModelId)

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">P</div>
          <div>
            <strong>Parametric</strong>
            <span>design studio</span>
          </div>
        </div>
        <div className="document-title">
          <span className="eyebrow">Untitled project</span>
          <strong>{model.name}</strong>
        </div>
        <div className="topbar-meta">
          <span className="stage-label"><span className="stage-dot" />Stage 01</span>
          <span className="autosave-label">Local workspace</span>
        </div>
      </header>
      <main className="workspace">
        <ModelPanel />
        <Viewport error={error} mesh={mesh} status={status} />
        <ParameterPanel />
      </main>
    </div>
  )
}
