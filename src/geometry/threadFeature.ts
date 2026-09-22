import type {
  NumberParameterDefinition,
  ParameterDefinition,
  ParameterValues,
  SelectParameterDefinition,
  ValidationResult,
} from '../parametric/types'

export type ThreadDirection = 'right' | 'left'

export interface ThreadFeatureParameters extends ParameterValues {
  diameter: number
  pitch: number
  length: number
  profileDepth: number
  direction: ThreadDirection
  internal: boolean
  clearance: number
}

export interface ThreadFeatureGeometry {
  majorRadius: number
  minorRadius: number
  length: number
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
  numberParameter('length', 'Length', 'Axial length of the threaded feature.', 0.01, 500, 0.1),
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

export function validateThreadFeature(parameters: ThreadFeatureParameters): ValidationResult {
  const errors: string[] = []
  const diameter = Number(parameters.diameter)
  const pitch = Number(parameters.pitch)
  const length = Number(parameters.length)
  const profileDepth = Number(parameters.profileDepth)
  const clearance = Number(parameters.clearance)

  if (!Number.isFinite(diameter) || diameter <= 0) errors.push('Thread diameter must be greater than zero.')
  if (!Number.isFinite(pitch) || pitch <= 0) errors.push('Thread pitch must be greater than zero.')
  if (!Number.isFinite(length) || length <= 0) errors.push('Thread length must be greater than zero.')
  if (!Number.isFinite(profileDepth) || profileDepth <= 0) {
    errors.push('Thread profile depth must be greater than zero.')
  }
  if (!Number.isFinite(clearance) || clearance < 0) errors.push('Thread clearance cannot be negative.')
  if (parameters.direction !== 'right' && parameters.direction !== 'left') {
    errors.push('Thread direction must be right or left.')
  }
  if (typeof parameters.internal !== 'boolean') errors.push('Thread internal must be a boolean.')
  if (Number.isFinite(profileDepth) && Number.isFinite(diameter) && profileDepth >= diameter / 2) {
    errors.push('Thread profile depth must be less than the thread radius.')
  }
  if (Number.isFinite(clearance) && Number.isFinite(pitch) && clearance > pitch / 2) {
    errors.push('Thread clearance is too large for the selected pitch.')
  }
  if (!parameters.internal && Number.isFinite(clearance) && Number.isFinite(diameter) && clearance >= diameter / 2) {
    errors.push('External thread clearance must be smaller than the thread radius.')
  }

  return { valid: errors.length === 0, errors }
}

function createThreadGeometry(parameters: ThreadFeatureParameters): ThreadFeatureGeometry {
  const diameter = Number(parameters.diameter)
  const pitch = Number(parameters.pitch)
  const length = Number(parameters.length)
  const profileDepth = Number(parameters.profileDepth)
  const clearance = Number(parameters.clearance)
  const externalMajorRadius = diameter / 2 - clearance
  const majorRadius = parameters.internal ? diameter / 2 + clearance : externalMajorRadius
  const minorRadius = parameters.internal ? majorRadius : majorRadius - profileDepth
  const directionSign = parameters.direction === 'left' ? -1 : 1

  return {
    majorRadius,
    minorRadius,
    length,
    radiusAt(distance, angle) {
      const axialTurns = distance / pitch
      const angularTurns = (directionSign * angle) / (Math.PI * 2)
      const phase = axialTurns + angularTurns
      const fraction = phase - Math.floor(phase)
      const ridge = fraction <= 0.5 ? fraction * 2 : (1 - fraction) * 2
      return parameters.internal
        ? majorRadius + profileDepth * ridge
        : minorRadius + profileDepth * ridge
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
