import { parametricCylinder } from '../generators/cylinder'
import type { ParametricModelDefinition } from './types'

export const modelRegistry: readonly ParametricModelDefinition[] = [parametricCylinder]

export function getModelDefinition(modelId: string): ParametricModelDefinition {
  const model = modelRegistry.find((candidate) => candidate.id === modelId)
  if (!model) {
    throw new Error(`Unknown parametric model: ${modelId}`)
  }
  return model
}
