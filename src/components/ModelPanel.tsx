import { modelRegistry } from '../parametric/registry'
import type { ParametricModelDefinition } from '../parametric/types'
import { useModelStore } from '../store/modelStore'

export function ModelPanel() {
  const selectedModelId = useModelStore((state) => state.selectedModelId)
  const selectModel = useModelStore((state) => state.selectModel)

  const categories = modelRegistry.reduce<Record<string, ParametricModelDefinition[]>>((groups, model) => {
    groups[model.category] ??= []
    groups[model.category].push(model)
    return groups
  }, {})

  return (
    <aside className="side-panel model-panel">
      <div className="panel-heading">
        <span className="eyebrow">Library</span>
        <h2>Generators</h2>
      </div>
      <div className="model-groups">
        {Object.entries(categories).map(([category, models]) => (
          <section className="model-group" key={category}>
            <h3>{category}</h3>
            {models.map((model) => (
              <button
                className={`model-card ${model.id === selectedModelId ? 'is-selected' : ''}`}
                key={model.id}
                onClick={() => selectModel(model.id)}
                type="button"
              >
                <span className="model-icon">◈</span>
                <span className="model-card-copy">
                  <strong>{model.name}</strong>
                  <small>{model.description}</small>
                </span>
                <span className="model-arrow">→</span>
              </button>
            ))}
          </section>
        ))}
      </div>
      <div className="panel-note">
        <span className="note-mark">i</span>
        <p>Choose a generator to start a new parametric body.</p>
      </div>
    </aside>
  )
}
