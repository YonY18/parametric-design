import { parametricCylinder } from '../generators/cylinder'
import { parametricWaveLamp } from '../generators/wave-lamp'
import type { ParametricModelDefinition } from './types'

export const modelRegistry: readonly ParametricModelDefinition[] = [parametricCylinder, parametricWaveLamp]

export function getModelDefinition(modelId: string): ParametricModelDefinition {
  const model = modelRegistry.find((candidate) => candidate.id === modelId)
  if (!model) {
    throw new Error(`Unknown parametric model: ${modelId}`)
  }
  return model
}
