import { getModelDefinition } from '../parametric/registry'
import type { NumberParameterDefinition, ParameterValues } from '../parametric/types'
import { useModelStore } from '../store/modelStore'

function resolveMax(parameter: NumberParameterDefinition, values: ParameterValues): number {
  return typeof parameter.max === 'function' ? parameter.max(values) : parameter.max
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function ParameterPanel() {
  const selectedModelId = useModelStore((state) => state.selectedModelId)
  const values = useModelStore((state) => state.parametersByModel[selectedModelId] ?? {})
  const setParameter = useModelStore((state) => state.setParameter)
  const model = getModelDefinition(selectedModelId)

  return (
    <aside className="side-panel parameter-panel">
      <div className="panel-heading parameter-heading">
        <span className="eyebrow">Inspector</span>
        <h2>Parameters</h2>
        <span className="backend-pill">{model.generation.backend} / {model.generation.operation}</span>
      </div>
      <p className="panel-description">{model.description}</p>
      <div className="parameter-list">
        {model.parameters.map((parameter) => {
          if (parameter.type !== 'number') return null
          const value = Number(values[parameter.id] ?? 0)
          const max = resolveMax(parameter, values)
          return (
            <div className="parameter-row" key={parameter.id}>
              <div className="parameter-label">
                <div>
                  <label htmlFor={`parameter-${parameter.id}`}>{parameter.label}</label>
                  <span className="unit-label">{parameter.unit}</span>
                </div>
                <input
                  aria-label={`${parameter.label} value`}
                  className="number-input"
                  max={max}
                  min={parameter.min}
                  onChange={(event) => {
                    const next = Number(event.target.value)
                    if (Number.isFinite(next)) setParameter(parameter.id, next)
                  }}
                  step={parameter.step}
                  type="number"
                  value={formatNumber(value)}
                />
              </div>
              <input
                aria-label={parameter.label}
                className="range-input"
                id={`parameter-${parameter.id}`}
                max={max}
                min={parameter.min}
                onChange={(event) => setParameter(parameter.id, Number(event.target.value))}
                step={parameter.step}
                type="range"
                value={value}
              />
              <div className="range-meta">
                <span>{formatNumber(parameter.min)} {parameter.unit}</span>
                <span>{formatNumber(max)} {parameter.unit}</span>
              </div>
              <p>{parameter.description}</p>
            </div>
          )
        })}
      </div>
      <div className="parameter-footer">
        <span className="footer-dot" />
        <span>Values are measured in millimeters</span>
      </div>
    </aside>
  )
}
