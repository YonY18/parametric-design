import type {
  NumberParameterDefinition,
  ParameterDefinition,
  SelectParameterDefinition,
  ValidationResult,
} from '../parametric/types'
import {
  deriveThreadTurns,
  threadSpecFromLegacy,
  validateThreadSpec,
  type ThreadHandedness,
  type ThreadProfileType,
  type ThreadSpec,
} from './threadSpec'

export type ThreadDirection = ThreadHandedness

export interface ThreadFeatureParameters {
  [key: string]: unknown
  threadSpec?: ThreadSpec
  diameter?: number
  pitch?: number
  length?: number
  profileDepth?: number
  direction?: ThreadDirection
  internal: boolean
  clearance?: number
}

export interface ThreadFeatureGeometry {
  majorRadius: number
  minorRadius: number
  length: number
  turns: number
  depth: number
  clearance: number
  handedness: ThreadHandedness
  profileType: ThreadProfileType
  radiusAt(distance: number, angle: number): number
}

export interface ThreadFeatureDefinition {
  id: string
  name: string
  category: string
  parameters: readonly ParameterDefinition[]
  validate(parameters: ThreadFeatureParameters): ValidationResult
  generate(parameters: ThreadFeatureParameters): ThreadFeatureGeometry
}

const numberParameter = (
  id: string,
  label: string,
  description: string,
  min: number,
  max: number,
  step: number,
): NumberParameterDefinition => ({ id, label, description, type: 'number', unit: 'mm', min, max, step })

const directionParameter: SelectParameterDefinition = {
  id: 'direction',
  label: 'Direction',
  description: 'Helix winding direction.',
  type: 'select',
  options: [
    { value: 'right', label: 'Right-hand' },
    { value: 'left', label: 'Left-hand' },
  ],
}

const threadFeatureParameters: readonly ParameterDefinition[] = [
  numberParameter('diameter', 'Diameter', 'Nominal thread diameter.', 0.01, 500, 0.1),
  numberParameter('pitch', 'Pitch', 'Axial distance between thread turns.', 0.01, 100, 0.1),
  numberParameter('length', 'Length', 'Length of the threaded feature.', 0.01, 500, 0.1),
  numberParameter('profileDepth', 'Profile depth', 'Radial depth of the triangular thread profile.', 0.001, 50, 0.05),
  directionParameter,
  {
    id: 'internal',
    label: 'Internal',
    description: 'Cut the feature into an internal cylindrical surface.',
    type: 'boolean',
  },
  numberParameter('clearance', 'Clearance', 'Radial manufacturing clearance.', 0, 20, 0.05),
]

function legacySpec(parameters: ThreadFeatureParameters): ThreadSpec {
  return threadSpecFromLegacy({
    nominalDiameter: Number(parameters.diameter),
    pitch: Number(parameters.pitch),
    length: Number(parameters.length),
    depth: Number(parameters.profileDepth),
    clearance: Number(parameters.clearance),
    handedness: parameters.direction,
  })
}

function resolveSpec(parameters: ThreadFeatureParameters): ThreadSpec {
  return parameters.threadSpec ?? legacySpec(parameters)
}

export function validateThreadFeature(parameters: ThreadFeatureParameters): ValidationResult {
  const errors: string[] = []
  let spec: ThreadSpec
  try {
    spec = resolveSpec(parameters)
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Thread parameters are invalid.')
    return { valid: false, errors }
  }
  errors.push(...validateThreadSpec(spec).errors)
  if (typeof parameters.internal !== 'boolean') errors.push('Thread internal must be a boolean.')
  if (!Number.isFinite(spec.nominalDiameter) || spec.nominalDiameter <= 0) {
    errors.push('Thread diameter must be greater than zero.')
  }
  return { valid: errors.length === 0, errors }
}

function createThreadGeometry(parameters: ThreadFeatureParameters): ThreadFeatureGeometry {
  const spec = resolveSpec(parameters)
  const directionSign = spec.handedness === 'left' ? -1 : 1
  const externalMinorRadius = spec.nominalDiameter / 2 - spec.depth
  const externalMajorRadius = spec.nominalDiameter / 2
  const internalMinorRadius = spec.nominalDiameter / 2 + spec.clearance
  const internalMajorRadius = internalMinorRadius + spec.depth

  return {
    majorRadius: parameters.internal ? internalMajorRadius : externalMajorRadius,
    minorRadius: parameters.internal ? internalMinorRadius : externalMinorRadius,
    length: spec.length,
    turns: deriveThreadTurns(spec),
    depth: spec.depth,
    clearance: spec.clearance,
    handedness: spec.handedness,
    profileType: spec.profileType,
    radiusAt(distance, angle) {
      const phase = distance / spec.pitch + (directionSign * angle) / (Math.PI * 2)
      const fraction = phase - Math.floor(phase)
      const ridge = fraction <= 0.5 ? fraction * 2 : (1 - fraction) * 2
      return parameters.internal
        ? internalMajorRadius - spec.depth * ridge
        : externalMinorRadius + spec.depth * ridge
    },
  }
}

export type ThreadFeature = ThreadFeatureDefinition

export const threadFeature: ThreadFeatureDefinition = {
  id: 'thread-feature',
  name: 'Thread Feature',
  category: 'Features',
  parameters: threadFeatureParameters,
  validate: validateThreadFeature,
  generate(parameters) {
    const validation = validateThreadFeature(parameters)
    if (!validation.valid) throw new Error(validation.errors.join(' '))
    return createThreadGeometry(parameters)
  },
}

export function generateThreadFeature(parameters: ThreadFeatureParameters): ThreadFeatureGeometry {
  return threadFeature.generate(parameters)
}

export const createThreadFeature = generateThreadFeature
