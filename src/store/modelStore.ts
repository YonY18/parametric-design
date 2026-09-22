import { create } from 'zustand'
import { getCadClient } from '../cad/cadClient'
import { modelRegistry, getModelDefinition } from '../parametric/registry'
import type {
  NumberParameterDefinition,
  ParameterValue,
  ParameterValues,
  ParametricModelDefinition,
  SelectParameterDefinition,
} from '../parametric/types'
import type { MeshData } from '../geometry/types'

export type GenerationStatus = 'idle' | 'generating' | 'ready' | 'error'

interface ModelStore {
  selectedModelId: string
  parametersByModel: Record<string, ParameterValues>
  mesh: MeshData | null
  status: GenerationStatus
  error: string | null
  initialized: boolean
  initialize: () => void
  selectModel: (modelId: string) => void
  setParameter: (parameterId: string, value: ParameterValue) => void
  resetParameters: () => void
  randomizeParameters: () => void
  regenerate: () => Promise<void>
}

const initialParameters = Object.fromEntries(
  modelRegistry.map((model) => [model.id, { ...model.defaults }]),
) as Record<string, ParameterValues>

let latestGeneration = 0
let debounceTimer: ReturnType<typeof setTimeout> | undefined

function clearDebounce(): void {
  if (debounceTimer === undefined) return
  clearTimeout(debounceTimer)
  debounceTimer = undefined
}

function clampParameters(model: ParametricModelDefinition, values: ParameterValues): ParameterValues {
  const nextValues = { ...values }
  for (const parameter of model.parameters) {
    if (parameter.type !== 'number') continue
    const max = typeof parameter.max === 'function' ? parameter.max(nextValues) : parameter.max
    const value = Number(nextValues[parameter.id])
    if (Number.isFinite(value)) {
      const clamped = Math.min(max, Math.max(parameter.min, value))
      nextValues[parameter.id] = parameter.integer ? Math.round(clamped) : clamped
    }
  }
  return nextValues
}

function applySelectValue(
  values: ParameterValues,
  parameter: SelectParameterDefinition,
  value: string,
): ParameterValues {
  const nextValues: ParameterValues = { ...values, [parameter.id]: value }
  const preset = parameter.presetValues?.[value]
  if (!preset) return nextValues
  for (const [id, presetValue] of Object.entries(preset)) {
    if (presetValue !== undefined) nextValues[id] = presetValue
  }
  return nextValues
}

function validationMessage(model: ParametricModelDefinition, values: ParameterValues): string | null {
  const validation = model.validate(values)
  return validation.valid ? null : validation.errors.join(' ')
}

function scheduleRegeneration(regenerate: () => Promise<void>): void {
  clearDebounce()
  debounceTimer = setTimeout(() => {
    debounceTimer = undefined
    void regenerate()
  }, 180)
}

export const useModelStore = create<ModelStore>((set, get) => ({
  selectedModelId: modelRegistry[0]?.id ?? '',
  parametersByModel: initialParameters,
  mesh: null,
  status: 'idle',
  error: null,
  initialized: false,

  initialize() {
    if (get().initialized) return
    set({ initialized: true })
    void get().regenerate()
  },

  selectModel(modelId) {
    const model = getModelDefinition(modelId)
    clearDebounce()
    latestGeneration += 1
    set({
      selectedModelId: model.id,
      mesh: null,
      status: 'idle',
      error: null,
    })
    void get().regenerate()
  },

  setParameter(parameterId, value) {
    const state = get()
    const model = getModelDefinition(state.selectedModelId)
    const parameter = model.parameters.find((candidate) => candidate.id === parameterId)
    if (!parameter) return

    const currentValues = state.parametersByModel[model.id] ?? model.defaults
    let nextValues: ParameterValues
    if (parameter.type === 'number') {
      if (typeof value !== 'number') return
      nextValues = clampParameters(model, { ...currentValues, [parameterId]: value })
    } else if (parameter.type === 'boolean') {
      if (typeof value !== 'boolean') return
      nextValues = { ...currentValues, [parameterId]: value }
    } else {
      if (typeof value !== 'string') return
      nextValues = applySelectValue(currentValues, parameter, value)
      nextValues = clampParameters(model, nextValues)
    }
    latestGeneration += 1
    set({
      parametersByModel: { ...state.parametersByModel, [model.id]: nextValues },
      status: 'generating',
      error: validationMessage(model, nextValues),
    })
    if (get().error) {
      clearDebounce()
      set({ status: 'error' })
      return
    }
    scheduleRegeneration(() => get().regenerate())
  },

  resetParameters() {
    const state = get()
    const model = getModelDefinition(state.selectedModelId)
    const values = model.reset()
    clearDebounce()
    latestGeneration += 1
    set({
      parametersByModel: { ...state.parametersByModel, [model.id]: values },
      status: 'generating',
      error: null,
    })
    scheduleRegeneration(() => get().regenerate())
  },

  randomizeParameters() {
    const state = get()
    const model = getModelDefinition(state.selectedModelId)
    const currentValues = state.parametersByModel[model.id] ?? model.defaults
    const values = clampParameters(model, model.randomize(currentValues))
    const error = validationMessage(model, values)
    clearDebounce()
    latestGeneration += 1
    set({
      parametersByModel: { ...state.parametersByModel, [model.id]: values },
      status: error ? 'error' : 'generating',
      error,
    })
    if (!error) scheduleRegeneration(() => get().regenerate())
  },

  async regenerate() {
    clearDebounce()
    const state = get()
    const model = getModelDefinition(state.selectedModelId)
    const parameters = state.parametersByModel[model.id] ?? model.defaults
    const validationError = validationMessage(model, parameters)
    const generationId = ++latestGeneration

    if (validationError) {
      set({ status: 'error', error: validationError })
      return
    }

    set({ status: 'generating', error: null })
    try {
      const mesh = await getCadClient().generate(model.generate(parameters))
      if (generationId !== latestGeneration) return
      set({ mesh, status: 'ready', error: null })
    } catch (error) {
      if (generationId !== latestGeneration) return
      set({ status: 'error', error: error instanceof Error ? error.message : 'Generation failed.' })
    }
  },
}))

export function resolveParameterMax(parameter: NumberParameterDefinition, values: ParameterValues): number {
  return typeof parameter.max === 'function' ? parameter.max(values) : parameter.max
}
