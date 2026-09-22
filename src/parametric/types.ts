import type { GeometryRequest } from '../geometry/types'

export type ParameterValue = number | string | boolean
export type ParameterValues = Record<string, ParameterValue>

export interface NumberParameterDefinition {
  id: string
  label: string
  description: string
  type: 'number'
  unit: string
  min: number
  max: number | ((values: ParameterValues) => number)
  step: number
}

export type ParameterDefinition = NumberParameterDefinition

export interface ModelGeneration<P extends ParameterValues = ParameterValues> {
  backend: GeometryRequest['backend']
  operation: string
  generate: (parameters: P) => GeometryRequest
}

export interface ParametricModelDefinition<P extends ParameterValues = ParameterValues> {
  id: string
  name: string
  category: string
  description: string
  parameters: readonly ParameterDefinition[]
  defaults: P
  generation: ModelGeneration<P>
}
