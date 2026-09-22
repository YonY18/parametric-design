import { getModelDefinition } from '../parametric/registry'
import type {
  NumberParameterDefinition,
  ParameterDefinition,
  ParameterSchema,
  ParameterSection,
  ParameterValue,
  ParameterValues,
  SelectParameterDefinition,
} from '../parametric/types'
import { resolveParameterMax, useModelStore } from '../store/modelStore'

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function isParameterDefinition(value: ParameterDefinition | ParameterSection): value is ParameterDefinition {
  return 'type' in value
}

function sectionsForSchema(schema: ParameterSchema): readonly ParameterSection[] {
  if (schema.length === 0) return []
  if (isParameterDefinition(schema[0])) {
    return [{ id: 'parameters', label: 'Parameters', parameters: schema as readonly ParameterDefinition[] }]
  }
  return schema
}

function isParameterVisible(parameter: ParameterDefinition, values: ParameterValues): boolean {
  const visibility = parameter.visibleWhen
  if (!visibility) return true
  if (typeof visibility === 'function') return visibility(values)
  const actual = values[visibility.parameterId]
  return Array.isArray(visibility.equals) ? visibility.equals.includes(actual) : actual === visibility.equals
}

function SelectParameterControl({
  parameter,
  value,
  onChange,
}: {
  parameter: SelectParameterDefinition
  value: string
  onChange: (id: string, next: string) => void
}) {
  return (
    <div className="parameter-row">
      <div className="parameter-label">
        <label htmlFor={`parameter-${parameter.id}`}>{parameter.label}</label>
        <select
          aria-label={parameter.label}
          id={`parameter-${parameter.id}`}
          onChange={(event) => onChange(parameter.id, event.target.value)}
          value={value}
        >
          {parameter.options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <p>{parameter.description}</p>
    </div>
  )
}

function NumberParameterControl({
  parameter,
  value,
  onChange,
  values,
}: {
  parameter: NumberParameterDefinition
  value: number
  onChange: (id: string, next: number) => void
  values: ParameterValues
}) {
  const max = resolveParameterMax(parameter, values)
  return (
    <div className="parameter-row">
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
            if (Number.isFinite(next)) onChange(parameter.id, next)
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
        onChange={(event) => onChange(parameter.id, Number(event.target.value))}
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
}

function BooleanParameterControl({
  parameter,
  value,
  onChange,
}: {
  parameter: Extract<ParameterDefinition, { type: 'boolean' }>
  value: boolean
  onChange: (id: string, next: boolean) => void
}) {
  return (
    <div className="parameter-row boolean-parameter">
      <label className="boolean-label" htmlFor={`parameter-${parameter.id}`}>
        <input
          aria-label={parameter.label}
          checked={value}
          className="boolean-input"
          id={`parameter-${parameter.id}`}
          onChange={(event) => onChange(parameter.id, event.target.checked)}
          type="checkbox"
        />
        <span>{parameter.label}</span>
      </label>
      <p>{parameter.description}</p>
    </div>
  )
}

function ParameterControl({
  parameter,
  value,
  onChange,
  values,
}: {
  parameter: ParameterDefinition
  value: ParameterValue
  onChange: (id: string, next: ParameterValue) => void
  values: ParameterValues
}) {
  if (parameter.type === 'boolean') {
    return (
      <BooleanParameterControl
        onChange={onChange}
        parameter={parameter}
        value={Boolean(value)}
      />
    )
  }
  if (parameter.type === 'select') {
    return (
      <SelectParameterControl
        onChange={onChange}
        parameter={parameter}
        value={String(value)}
      />
    )
  }
  return (
    <NumberParameterControl
      onChange={onChange}
      parameter={parameter}
      value={Number(value)}
      values={values}
    />
  )
}

export function ParameterPanel() {
  const selectedModelId = useModelStore((state) => state.selectedModelId)
  const values = useModelStore((state) => state.parametersByModel[selectedModelId] ?? {})
  const setParameter = useModelStore((state) => state.setParameter)
  const resetParameters = useModelStore((state) => state.resetParameters)
  const randomizeParameters = useModelStore((state) => state.randomizeParameters)
  const model = getModelDefinition(selectedModelId)
  const sections = sectionsForSchema(model.parameterSchema)

  return (
    <aside className="side-panel parameter-panel">
      <div className="panel-heading parameter-heading">
        <span className="eyebrow">Inspector</span>
        <h2>Parameters</h2>
        <span className="backend-pill">{model.generation.backend} / {model.generation.operation}</span>
      </div>
      <div className="parameter-actions">
        <button onClick={resetParameters} type="button">Reset parameters</button>
        <button onClick={randomizeParameters} type="button">Randomize</button>
      </div>
      <p className="panel-description">{model.description}</p>
      <div className="parameter-list">
        {sections.map((section) => (
          <section className="parameter-section" key={section.id}>
            <h3>{section.label}</h3>
            {section.description && <p className="parameter-section-description">{section.description}</p>}
            {section.groups?.map((group) => (
              <div className="parameter-group" key={group.id}>
                <h4>{group.label}</h4>
                {group.description && <p className="parameter-group-description">{group.description}</p>}
                {group.parameters.map((parameter) => {
                  if (!isParameterVisible(parameter, values)) return null
                  const value = values[parameter.id] ?? (parameter.type === 'boolean'
                    ? false
                    : parameter.type === 'select' ? parameter.options[0]?.value ?? '' : 0)
                  return (
                    <ParameterControl
                      key={parameter.id}
                      onChange={setParameter}
                      parameter={parameter}
                      value={value}
                      values={values}
                    />
                  )
                })}
              </div>
            ))}
            {section.parameters?.map((parameter) => {
              if (!isParameterVisible(parameter, values)) return null
              const value = values[parameter.id] ?? (parameter.type === 'boolean'
                ? false
                : parameter.type === 'select' ? parameter.options[0]?.value ?? '' : 0)
              return (
                <ParameterControl
                  key={parameter.id}
                  onChange={setParameter}
                  parameter={parameter}
                  value={value}
                  values={values}
                />
              )
            })}
          </section>
        ))}
      </div>
      <div className="parameter-footer">
        <span className="footer-dot" />
        <span>Values are measured in millimeters</span>
      </div>
    </aside>
  )
}
