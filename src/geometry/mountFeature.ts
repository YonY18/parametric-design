import { generateThreadedHub, validateThreadedHub, type ThreadedHubGeneration } from './threadedHub'
import { createThreadSpec, type ThreadSpec } from './threadSpec'
import { createConnectionFrame } from './types'

export interface MountFeatureInput {
  centerHoleDiameter: number
  nominalThreadDiameter: number
  threadPitch: number
  threadClearance: number
  baseThickness: number
  radialSegments: number
}

export interface MountFeatureParameters extends MountFeatureInput {
  threadSpec: ThreadSpec
  hubHeight: number
}

export interface MountFeatureGeneration extends ThreadedHubGeneration {
  mountFeature: {
    centerHoleDiameter: number
    threadSpec: ThreadSpec
  }
}

export function deriveMountFeature(input: MountFeatureInput): MountFeatureParameters {
  const threadSpec = createThreadSpec({
    nominalDiameter: input.nominalThreadDiameter,
    pitch: input.threadPitch,
    length: Math.max(input.baseThickness, input.threadPitch * 2),
    depth: Math.min(input.threadPitch / 4, input.nominalThreadDiameter / 8),
    clearance: input.threadClearance,
    handedness: 'right',
    profileType: 'metric-like triangular',
  })
  return {
    ...input,
    threadSpec,
    hubHeight: Math.max(input.baseThickness, threadSpec.length),
  }
}

export function validateMountFeature(parameters: MountFeatureParameters): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (!Number.isFinite(parameters.centerHoleDiameter) || parameters.centerHoleDiameter < 0) {
    errors.push('Mount feature center hole diameter cannot be negative.')
  }
  if (!Number.isFinite(parameters.baseThickness) || parameters.baseThickness <= 0) errors.push('Mount feature base thickness must be greater than zero.')
  if (!Number.isInteger(parameters.radialSegments) || parameters.radialSegments < 16) errors.push('Mount feature radial segments must be an integer of at least 16.')
  if (Number.isFinite(parameters.centerHoleDiameter)
    && Number.isFinite(parameters.threadSpec.nominalDiameter)
    && parameters.centerHoleDiameter >= parameters.threadSpec.nominalDiameter) {
    errors.push('Mount feature center hole must be smaller than the nominal thread diameter.')
  }
  const hub = {
    hubOuterDiameter: parameters.threadSpec.nominalDiameter,
    hubHeight: parameters.hubHeight,
    hubWallThickness: (parameters.threadSpec.nominalDiameter - parameters.centerHoleDiameter) / 2,
    hubOpeningDiameter: Math.max(0.1, parameters.centerHoleDiameter),
    threadSpec: parameters.threadSpec,
    radialSegments: parameters.radialSegments,
  }
  errors.push(...validateThreadedHub(hub).errors)
  return { valid: errors.length === 0, errors }
}

export function generateMountFeature(
  parameters: MountFeatureParameters,
  requestedFrame = createConnectionFrame(0, parameters.threadSpec.nominalDiameter / 2),
): MountFeatureGeneration {
  const validation = validateMountFeature(parameters)
  if (!validation.valid) throw new Error(validation.errors.join(' '))
  const hub = generateThreadedHub({
    hubOuterDiameter: parameters.threadSpec.nominalDiameter,
    hubHeight: parameters.hubHeight,
    hubWallThickness: (parameters.threadSpec.nominalDiameter - parameters.centerHoleDiameter) / 2,
    hubOpeningDiameter: Math.max(0.1, parameters.centerHoleDiameter),
    threadSpec: parameters.threadSpec,
    radialSegments: parameters.radialSegments,
  }, requestedFrame)
  return {
    ...hub,
    mountFeature: {
      centerHoleDiameter: parameters.centerHoleDiameter,
      threadSpec: parameters.threadSpec,
    },
  }
}

export const createMountFeature = generateMountFeature
