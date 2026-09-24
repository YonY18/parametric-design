import type { ValidationResult } from '../parametric/types'
import type { RetainingRingParameters } from './retainingRing'
import type { ThreadedHubParameters } from './threadedHub'
import type { InternalShadeSupportParameters } from './internalShadeSupport'

export type MechanicalMountType = 'none' | 'threaded'

export interface MechanicalCoreInput {
  mountType: MechanicalMountType
  nominalThreadDiameter: number
  threadPitch: number
  threadClearance: number
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
  dimensions: MechanicalCoreDimensions
  hub: ThreadedHubParameters
  ring: RetainingRingParameters
  support: InternalShadeSupportParameters
}

const supportSafetyOffset = 0.5

function finite(value: number): boolean {
  return Number.isFinite(value)
}

export function deriveMechanicalCoreDimensions(input: MechanicalCoreInput): MechanicalCoreDimensions {
  const minimumWallThickness = Math.max(2, input.threadPitch)
  const hubSafetyOffset = Math.max(0.25, input.threadClearance)
  const hubOpeningDiameter = input.nominalThreadDiameter + input.threadClearance * 2
  const hubOuterDiameter = hubOpeningDiameter + minimumWallThickness * 2
  const hubHeight = Math.max(10, input.threadPitch * 6)
  const ringWallThickness = minimumWallThickness
  const ringInnerDiameter = hubOpeningDiameter
  const ringOuterDiameter = ringInnerDiameter + ringWallThickness * 2
  const ringHeight = Math.max(6, input.threadPitch * 4)
  const supportInnerDiameter = hubOuterDiameter + supportSafetyOffset
  const supportOuterDiameter = Math.max(
    supportInnerDiameter + supportSafetyOffset * 2,
    input.maxDiameter !== undefined && finite(input.maxDiameter)
      ? input.maxDiameter - input.wallThickness * 2
      : 0,
  )

  return {
    hubOuterDiameter,
    hubHeight,
    hubWallThickness: minimumWallThickness,
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
    threadLength: hubHeight,
  }
}

export function validateMechanicalCoreInput(input: MechanicalCoreInput): ValidationResult {
  const errors: string[] = []
  if (input.mountType !== 'none' && input.mountType !== 'threaded') {
    errors.push('Mount type must be None or Threaded.')
  }
  if (input.mountType === 'none') return { valid: errors.length === 0, errors }

  if (!finite(input.nominalThreadDiameter) || input.nominalThreadDiameter < 8 || input.nominalThreadDiameter > 80) {
    errors.push('Thread diameter must be between 8 and 80 mm.')
  }
  if (!finite(input.threadPitch) || input.threadPitch < 0.5 || input.threadPitch > 8) {
    errors.push('Thread pitch must be between 0.5 and 8 mm.')
  }
  if (!finite(input.threadClearance) || input.threadClearance < 0 || input.threadClearance > input.threadPitch / 2) {
    errors.push('Thread clearance is too large for selected pitch.')
  }
  if (!finite(input.cableHoleDiameter) || input.cableHoleDiameter < 0
    || (finite(input.nominalThreadDiameter) && finite(input.threadClearance)
      && input.cableHoleDiameter >= input.nominalThreadDiameter + input.threadClearance * 2)) {
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
    const ringThreadLength = Math.max(input.threadPitch * 3, dimensions.ringHeight - input.threadPitch)
    const engagement = Math.min(dimensions.threadLength, ringThreadLength)
    if (engagement < input.threadPitch) errors.push('Retaining ring engagement is insufficient.')
  }

  return { valid: errors.length === 0, errors }
}

export function deriveMechanicalCore(input: MechanicalCoreInput): MechanicalCoreParameters {
  const validation = validateMechanicalCoreInput(input)
  if (!validation.valid) throw new Error(validation.errors.join(' '))
  const dimensions = deriveMechanicalCoreDimensions(input)
  return {
    dimensions,
    hub: {
      hubOuterDiameter: dimensions.hubOuterDiameter,
      hubHeight: dimensions.hubHeight,
      hubWallThickness: dimensions.hubWallThickness,
      threadDiameter: input.nominalThreadDiameter,
      threadPitch: input.threadPitch,
      threadLength: dimensions.threadLength,
      threadClearance: input.threadClearance,
      threadDirection: 'right',
      radialSegments: input.radialSegments,
    },
    ring: {
      outerDiameter: dimensions.ringOuterDiameter,
      innerDiameter: dimensions.ringInnerDiameter,
      height: dimensions.ringHeight,
      wallThickness: dimensions.ringWallThickness,
      threadDiameter: input.nominalThreadDiameter,
      threadPitch: input.threadPitch,
      threadLength: Math.max(input.threadPitch * 3, dimensions.ringHeight - input.threadPitch),
      threadClearance: input.threadClearance,
      threadDirection: 'right',
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
