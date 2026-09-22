import { create } from 'zustand'
import { getCadClient } from '../cad/cadClient'
import { modelRegistry, getModelDefinition } from '../parametric/registry'
import type { ParameterValue, ParameterValues } from '../parametric/types'
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
  regenerate: () => Promise<void>
}

const initialParameters = Object.fromEntries(
  modelRegistry.map((model) => [model.id, { ...model.defaults }]),
) as Record<string, ParameterValues>

let latestGeneration = 0

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
    if (!parameter || parameter.type !== 'number' || typeof value !== 'number') return

    const currentValues = state.parametersByModel[model.id] ?? model.defaults
    const nextValues: ParameterValues = { ...currentValues, [parameterId]: value }
    for (const candidate of model.parameters) {
      if (candidate.type !== 'number') continue
      const max = typeof candidate.max === 'function' ? candidate.max(nextValues) : candidate.max
      const candidateValue = Number(nextValues[candidate.id])
      nextValues[candidate.id] = Math.min(max, Math.max(candidate.min, candidateValue))
    }
    set({
      parametersByModel: { ...state.parametersByModel, [model.id]: nextValues },
      status: 'generating',
      error: null,
    })
    void get().regenerate()
  },

  async regenerate() {
    const state = get()
    const model = getModelDefinition(state.selectedModelId)
    const parameters = state.parametersByModel[model.id] ?? model.defaults
    const generationId = ++latestGeneration

    set({ status: 'generating', error: null })
    try {
      const mesh = await getCadClient().generate(model.generation.generate(parameters))
      if (generationId !== latestGeneration) return
      set({ mesh, status: 'ready', error: null })
    } catch (error) {
      if (generationId !== latestGeneration) return
      set({ status: 'error', error: error instanceof Error ? error.message : 'Generation failed.' })
    }
  },
}))
