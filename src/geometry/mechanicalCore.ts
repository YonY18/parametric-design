import type { ValidationResult } from '../parametric/types'
import { createThreadSpec, threadSpecFromLegacy, validateThreadSpec, type ThreadHandedness, type ThreadProfileType, type ThreadSpec } from './threadSpec'
import type { RetainingRingParameters } from './retainingRing'
import type { ThreadedHubParameters } from './threadedHub'
import type { InternalShadeSupportParameters } from './internalShadeSupport'

export type MechanicalMountType = 'none' | 'threaded'

export interface MechanicalCoreInput {
  mountType: MechanicalMountType
  threadSpec?: ThreadSpec
  nominalThreadDiameter?: number
  threadPitch?: number
  threadLength?: number
  threadDepth?: number
  threadClearance?: number
  threadHandedness?: ThreadHandedness
  threadProfileType?: ThreadProfileType
  cableHoleDiameter: number
  supportInset: number
  supportThickness: number
  wallThickness: number
  height: number
  radialSegments: number
  maxDiameter?: number
}

export interface MechanicalCoreDimensions {
  hubOuterDiameter: number
  hubHeight: number
  hubWallThickness: number
  hubOpeningDiameter: number
  hubSafetyOffset: number
  ringInnerDiameter: number
  ringOuterDiameter: number
  ringHeight: number
  ringWallThickness: number
  ringSafetyOffset: number
  supportInnerDiameter: number
  supportOuterDiameter: number
  supportSafetyOffset: number
  minimumWallThickness: number
  threadLength: number
}

export interface MechanicalCoreParameters {
  threadSpec: ThreadSpec
  dimensions: MechanicalCoreDimensions
  hub: ThreadedHubParameters
  ring: RetainingRingParameters
  support: InternalShadeSupportParameters
}

const supportSafetyOffset = 0.5

function finite(value: number): boolean {
  return Number.isFinite(value)
}

function resolveThreadSpec(input: MechanicalCoreInput): ThreadSpec {
  if (input.threadSpec) return createThreadSpec(input.threadSpec)
  return threadSpecFromLegacy({
    nominalDiameter: Number(input.nominalThreadDiameter),
    pitch: Number(input.threadPitch),
    length: input.threadLength,
    depth: input.threadDepth,
    clearance: input.threadClearance,
    handedness: input.threadHandedness,
    profileType: input.threadProfileType,
  })
}

export function deriveMechanicalCoreDimensions(input: MechanicalCoreInput): MechanicalCoreDimensions {
  const threadSpec = resolveThreadSpec(input)
  const minimumWallThickness = Math.max(2, threadSpec.pitch)
  const hubSafetyOffset = Math.max(0.25, threadSpec.clearance)
  const hubOpeningDiameter = Math.max(0.1, input.cableHoleDiameter)
  const hubOuterDiameter = threadSpec.nominalDiameter
  const hubHeight = Math.max(10, threadSpec.length)
  const hubWallThickness = (hubOuterDiameter - hubOpeningDiameter) / 2
  const ringInnerDiameter = threadSpec.nominalDiameter + 2 * (threadSpec.clearance + threadSpec.depth)
  const ringWallThickness = minimumWallThickness
  const ringOuterDiameter = ringInnerDiameter + ringWallThickness * 2
  const ringHeight = Math.max(6, threadSpec.length)
  const supportInnerDiameter = hubOuterDiameter + minimumWallThickness * 2 + supportSafetyOffset
  const supportOuterDiameter = Math.max(
    supportInnerDiameter + supportSafetyOffset * 2,
    input.maxDiameter !== undefined && finite(input.maxDiameter)
      ? input.maxDiameter - input.wallThickness * 2
      : 0,
  )

  return {
    hubOuterDiameter,
    hubHeight,
    hubWallThickness,
    hubOpeningDiameter,
    hubSafetyOffset,
    ringInnerDiameter,
    ringOuterDiameter,
    ringHeight,
    ringWallThickness,
    ringSafetyOffset: hubSafetyOffset,
    supportInnerDiameter,
    supportOuterDiameter,
    supportSafetyOffset,
    minimumWallThickness,
    threadLength: threadSpec.length,
  }
}

export function validateMechanicalCoreInput(input: MechanicalCoreInput): ValidationResult {
  const errors: string[] = []
  if (input.mountType !== 'none' && input.mountType !== 'threaded') {
    errors.push('Mount type must be None or Threaded.')
  }
  if (input.mountType === 'none') return { valid: errors.length === 0, errors }

  let threadSpec: ThreadSpec
  try {
    threadSpec = resolveThreadSpec(input)
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Thread specification is invalid.')
    return { valid: false, errors }
  }
  errors.push(...validateThreadSpec(threadSpec).errors)
  if (!finite(input.cableHoleDiameter) || input.cableHoleDiameter < 0
    || input.cableHoleDiameter >= threadSpec.nominalDiameter) {
    errors.push('Cable hole too large for selected hub.')
  }
  if (!finite(input.wallThickness) || input.wallThickness <= 0) {
    errors.push('Wall thickness must be greater than zero.')
  }
  if (!finite(input.height) || input.height <= 0) {
    errors.push('Shade height must be greater than zero.')
  }
  if (!finite(input.supportInset) || input.supportInset <= 0 || input.supportInset >= input.height) {
    errors.push('Support inset must stay inside the shade.')
  }
  if (!finite(input.supportThickness) || input.supportThickness <= 0 || input.supportInset + input.supportThickness > input.height) {
    errors.push('Support thickness must stay inside the shade.')
  }
  if (!Number.isInteger(input.radialSegments) || input.radialSegments < 32) {
    errors.push('Radial segments must be at least 32.')
  }

  if (errors.length === 0) {
    const dimensions = deriveMechanicalCoreDimensions(input)
    const engagement = Math.min(dimensions.threadLength, dimensions.ringHeight)
    if (engagement < threadSpec.pitch) errors.push('Retaining ring engagement is insufficient.')
  }

  return { valid: errors.length === 0, errors }
}

export function deriveMechanicalCore(input: MechanicalCoreInput): MechanicalCoreParameters {
  const validation = validateMechanicalCoreInput(input)
  if (!validation.valid) throw new Error(validation.errors.join(' '))
  const threadSpec = resolveThreadSpec(input)
  const dimensions = deriveMechanicalCoreDimensions(input)
  return {
    threadSpec,
    dimensions,
    hub: {
      hubOuterDiameter: dimensions.hubOuterDiameter,
      hubHeight: dimensions.hubHeight,
      hubWallThickness: dimensions.hubWallThickness,
      hubOpeningDiameter: dimensions.hubOpeningDiameter,
      threadSpec,
      threadDiameter: threadSpec.nominalDiameter,
      threadPitch: threadSpec.pitch,
      threadLength: threadSpec.length,
      threadClearance: threadSpec.clearance,
      threadDirection: threadSpec.handedness,
      radialSegments: input.radialSegments,
    },
    ring: {
      outerDiameter: dimensions.ringOuterDiameter,
      innerDiameter: dimensions.ringInnerDiameter,
      height: dimensions.ringHeight,
      wallThickness: dimensions.ringWallThickness,
      threadSpec,
      threadDiameter: threadSpec.nominalDiameter,
      threadPitch: threadSpec.pitch,
      threadLength: threadSpec.length,
      threadClearance: threadSpec.clearance,
      threadDirection: threadSpec.handedness,
      gripStyle: 'smooth',
      gripDepth: 0,
      gripCount: 12,
    },
    support: {
      supportType: 'annular',
      supportInset: input.supportInset,
      supportThickness: input.supportThickness,
      hubOuterDiameter: dimensions.hubOuterDiameter,
      shadeWallThickness: input.wallThickness,
      radialSegments: input.radialSegments,
    },
  }
}
