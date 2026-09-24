import { validateConnectionFrame } from './assembly'
import { generateRevolvedProfileMesh } from './revolvedMesh'
import type { RimStyle } from './rimInterface'
import { createConnectionFrame, type ConnectionFrame, type MeshData } from './types'

export type GenericBaseType = 'flat-disc' | 'recessed-step'
export type BasePreset = 'standard' | 'wide' | 'compact'

export interface BaseRimProfile {
  baseType: GenericBaseType
  basePreset: BasePreset
  baseOuterDiameter: number
  baseThickness: number
  recessedDepth: number
  recessedOuterDiameter: number
  supportFaceDiameter: number
  supportJoinWidth: number
  centerHoleDiameter: number
  rimOuterDiameter: number
  rimInnerDiameter: number
  rimThickness: number
  rimHeight: number
  rimLipDepth: number
  rimStyle: RimStyle
  rimFitClearance: number
}

export interface BaseRimProfileInput {
  baseType: GenericBaseType
  basePreset: BasePreset
  baseThickness: number
  recessedDepth: number
  centerHoleDiameter: number
  shadeOuterDiameter: number
  shadeWallThickness: number
  rimThickness: number
  rimHeight: number
  rimLipDepth: number
  rimFitClearance: number
  rimStyle?: RimStyle
}

export interface GenericBaseInput {
  baseRimProfile: BaseRimProfile
  radialSegments?: number
}

export interface GenericBaseGeneration {
  mesh: MeshData
  baseRimProfile: BaseRimProfile
  inputFrame: ConnectionFrame
  outputFrame: ConnectionFrame
  supportFaceFrame: ConnectionFrame
}

function finite(value: number): boolean {
  return Number.isFinite(value)
}

export function deriveBaseRimProfile(input: BaseRimProfileInput): BaseRimProfile {
  const rimOuterDiameter = input.shadeOuterDiameter - 2 * (input.shadeWallThickness + input.rimFitClearance)
  const rimInnerDiameter = rimOuterDiameter - 2 * input.rimThickness
  const supportJoinWidth = input.basePreset === 'wide'
    ? Math.max(10, input.rimThickness * 3)
    : input.basePreset === 'compact'
      ? Math.max(3, input.rimThickness)
      : Math.max(6, input.rimThickness * 2)
  const baseOuterDiameter = rimOuterDiameter + supportJoinWidth * 2
  const recessedOuterDiameter = input.baseType === 'recessed-step'
    ? rimInnerDiameter - input.rimFitClearance * 2
    : 0
  return {
    baseType: input.baseType,
    basePreset: input.basePreset,
    baseOuterDiameter,
    baseThickness: input.baseThickness,
    recessedDepth: input.baseType === 'recessed-step' ? input.recessedDepth : 0,
    recessedOuterDiameter,
    supportFaceDiameter: input.baseType === 'recessed-step' ? recessedOuterDiameter : rimOuterDiameter,
    supportJoinWidth,
    centerHoleDiameter: input.centerHoleDiameter,
    rimOuterDiameter,
    rimInnerDiameter,
    rimThickness: input.rimThickness,
    rimHeight: input.rimHeight,
    rimLipDepth: input.rimLipDepth,
    rimStyle: input.rimStyle ?? 'circular-lip',
    rimFitClearance: input.rimFitClearance,
  }
}

export const deriveBaseRimProfileFromShade = deriveBaseRimProfile

export function validateBaseRimProfile(profile: BaseRimProfile): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (profile.baseType !== 'flat-disc' && profile.baseType !== 'recessed-step') errors.push('Base type must be flat-disc or recessed-step.')
  if (!['standard', 'wide', 'compact'].includes(profile.basePreset)) errors.push('Base preset is invalid.')
  if (!finite(profile.baseOuterDiameter) || profile.baseOuterDiameter <= 0) errors.push('Base outer diameter must be greater than zero.')
  if (!finite(profile.baseThickness) || profile.baseThickness <= 0) errors.push('Base thickness must be greater than zero.')
  if (!finite(profile.recessedDepth) || profile.recessedDepth < 0) errors.push('Recessed depth cannot be negative.')
  if (!finite(profile.centerHoleDiameter) || profile.centerHoleDiameter < 0) errors.push('Center hole diameter cannot be negative.')
  if (!finite(profile.rimOuterDiameter) || !finite(profile.rimInnerDiameter)
    || profile.rimOuterDiameter <= profile.rimInnerDiameter || profile.rimInnerDiameter <= 0) {
    errors.push('Base rim profile requires a valid rim diameter pair.')
  }
  if (!finite(profile.rimThickness) || profile.rimThickness <= 0) errors.push('Base rim profile rim thickness must be greater than zero.')
  if (!finite(profile.rimHeight) || profile.rimHeight <= 0) errors.push('Base rim profile rim height must be greater than zero.')
  if (!finite(profile.rimLipDepth) || profile.rimLipDepth < 0) errors.push('Base rim profile lip depth cannot be negative.')
  if (profile.rimStyle !== 'plain' && profile.rimStyle !== 'circular-lip') errors.push('Base rim profile rim style is invalid.')
  if (!finite(profile.rimFitClearance) || profile.rimFitClearance < 0) errors.push('Base rim profile fit clearance cannot be negative.')
  if (profile.baseType === 'recessed-step') {
    if (profile.recessedDepth <= 0) errors.push('Recessed-step bases require a positive recessed depth.')
    if (!finite(profile.recessedOuterDiameter) || profile.recessedOuterDiameter <= 0) errors.push('Recessed step diameter must be greater than zero.')
  }
  const supportDiameter = profile.supportFaceDiameter
  if (finite(profile.centerHoleDiameter) && finite(supportDiameter) && profile.centerHoleDiameter >= supportDiameter) {
    errors.push('Center hole must leave material around the base support profile.')
  }
  if (finite(profile.baseOuterDiameter) && finite(profile.rimOuterDiameter) && profile.baseOuterDiameter < profile.rimOuterDiameter) {
    errors.push('Base outer diameter must be compatible with the rim outer diameter.')
  }
  return { valid: errors.length === 0, errors }
}

export function generateGenericBase(
  input: GenericBaseInput,
  requestedFrame = createConnectionFrame(0, input.baseRimProfile.baseOuterDiameter / 2),
): GenericBaseGeneration {
  const baseRimProfile = input.baseRimProfile
  const validation = validateBaseRimProfile(baseRimProfile)
  if (!validation.valid) throw new Error(validation.errors.join(' '))
  validateConnectionFrame(requestedFrame, 'Generic Base input frame')
  const baseZ = requestedFrame.position.z
  const baseTopZ = baseZ + baseRimProfile.baseThickness
  const stepTopZ = baseTopZ + baseRimProfile.recessedDepth
  const outerRadius = baseRimProfile.baseOuterDiameter / 2
  const holeRadius = baseRimProfile.centerHoleDiameter / 2
  const profile = baseRimProfile.baseType === 'recessed-step'
    ? [
      { radius: outerRadius, z: baseZ },
      { radius: outerRadius, z: baseTopZ },
      { radius: baseRimProfile.recessedOuterDiameter / 2, z: baseTopZ },
      { radius: baseRimProfile.recessedOuterDiameter / 2, z: stepTopZ },
      { radius: holeRadius, z: stepTopZ },
      { radius: holeRadius, z: baseZ },
    ]
    : [
      { radius: outerRadius, z: baseZ },
      { radius: outerRadius, z: baseTopZ },
      { radius: holeRadius, z: baseTopZ },
      { radius: holeRadius, z: baseZ },
    ]
  const mesh = generateRevolvedProfileMesh(profile, input.radialSegments ?? 64, 'Generic Base')
  const inputFrame = createConnectionFrame(baseZ, outerRadius)
  const outputFrame = createConnectionFrame(baseTopZ, baseRimProfile.rimOuterDiameter / 2)
  const supportFaceFrame = createConnectionFrame(
    baseTopZ,
    (baseRimProfile.supportFaceDiameter || baseRimProfile.rimOuterDiameter) / 2,
  )
  validateConnectionFrame(inputFrame, 'Generic Base input frame')
  validateConnectionFrame(outputFrame, 'Generic Base output frame')
  validateConnectionFrame(supportFaceFrame, 'Generic Base support face frame')
  return { mesh, baseRimProfile, inputFrame, outputFrame, supportFaceFrame }
}

export const createGenericBase = generateGenericBase

