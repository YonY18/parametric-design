import type { GeometryRequest } from '../geometry/types'

export type ParameterValue = number | string | boolean
export type ParameterValues = Record<string, ParameterValue>

export type ParameterVisibility =
  | ((values: ParameterValues) => boolean)
  | { parameterId: string; equals: ParameterValue | readonly ParameterValue[] }

interface ParameterDefinitionBase {
  id: string
  label: string
  description: string
  visibleWhen?: ParameterVisibility
}

export interface NumberParameterDefinition extends ParameterDefinitionBase {
  type: 'number'
  unit: string
  min: number
  max: number | ((values: ParameterValues) => number)
  step: number
  integer?: boolean
}

export interface BooleanParameterDefinition extends ParameterDefinitionBase {
  type: 'boolean'
}

export interface SelectParameterOption {
  value: string
  label: string
}

export interface SelectParameterDefinition extends ParameterDefinitionBase {
  type: 'select'
  options: readonly SelectParameterOption[]
  presetValues?: Readonly<Record<string, Partial<ParameterValues>>>
}

export type ParameterDefinition = NumberParameterDefinition | BooleanParameterDefinition | SelectParameterDefinition

export interface ParameterGroup {
  id: string
  label: string
  description?: string
  parameters: readonly ParameterDefinition[]
}

export interface ParameterSection {
  id: string
  label: string
  description?: string
  parameters?: readonly ParameterDefinition[]
  groups?: readonly ParameterGroup[]
}

export type ParameterSchema = readonly ParameterDefinition[] | readonly ParameterSection[]

export interface ModelGeneration<P extends ParameterValues = ParameterValues> {
  backend: GeometryRequest['backend']
  operation: string
  generate(parameters: P): GeometryRequest
}

export interface ModelMetadata {
  name: string
  category: string
  description: string
}

export interface ValidationResult {
  valid: boolean
  errors: readonly string[]
}

export interface ParametricModelDefinition<P extends ParameterValues = ParameterValues> {
  id: string
  name: string
  category: string
  description: string
  metadata: ModelMetadata
  parameters: readonly ParameterDefinition[]
  parameterSchema: ParameterSchema
  defaults: P
  generation: ModelGeneration<P>
  validate(parameters: P): ValidationResult
  generate(parameters: P): GeometryRequest
  reset(): P
  randomize(parameters: P, random?: () => number): P
}
