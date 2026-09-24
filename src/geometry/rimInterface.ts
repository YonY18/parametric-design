import { validateConnectionFrame } from './assembly'
import { generateRevolvedProfileMesh } from './revolvedMesh'
import { createConnectionFrame, type ConnectionFrame, type MeshData, type ProfileRing } from './types'

export type RimStyle = 'plain' | 'circular-lip'

export interface RimInterface {
  rimDiameter: number
  rimOuterDiameter: number
  rimInnerDiameter: number
  rimThickness: number
  rimHeight: number
  rimLipDepth: number
  rimStyle: RimStyle
  rimClearance: number
  // Legacy alias retained for saved models and isolated callers.
  rimFitClearance: number
}

export interface RimInterfaceInput {
  rimDiameter?: number
  diameter?: number
  rimOuterDiameter?: number
  rimInnerDiameter?: number
  rimThickness: number
  rimHeight: number
  rimLipDepth: number
  rimClearance?: number
  rimFitClearance?: number
  // Legacy derived-diameter inputs.
  shadeOuterDiameter?: number
  shadeWallThickness?: number
  rimStyle?: RimStyle
}

export interface RimInterfaceGeneration {
  mesh: MeshData
  rim: RimInterface
  inputFrame: ConnectionFrame
  outputFrame: ConnectionFrame
  outerProfile: ProfileRing
}

function finite(value: number): boolean {
  return Number.isFinite(value)
}

export function deriveRimInterface(input: RimInterfaceInput | RimInterface): RimInterface {
  if ('rimOuterDiameter' in input && input.rimOuterDiameter !== undefined) {
    const rimClearance = input.rimClearance ?? input.rimFitClearance
    return {
      rimDiameter: input.rimDiameter ?? input.rimOuterDiameter,
      rimOuterDiameter: input.rimOuterDiameter,
      rimInnerDiameter: input.rimInnerDiameter ?? input.rimOuterDiameter - 2 * input.rimThickness,
      rimThickness: input.rimThickness,
      rimHeight: input.rimHeight,
      rimLipDepth: input.rimLipDepth,
      rimStyle: input.rimStyle ?? 'circular-lip',
      rimClearance: rimClearance ?? 0,
      rimFitClearance: rimClearance ?? 0,
    }
  }

  const legacyInput = input as RimInterfaceInput
  const rimClearance = legacyInput.rimClearance ?? legacyInput.rimFitClearance ?? 0
  const legacyDiameter = Number(legacyInput.shadeOuterDiameter) - 2 * (Number(legacyInput.shadeWallThickness) + rimClearance)
  const rimDiameter = legacyInput.rimDiameter ?? legacyInput.diameter ?? legacyDiameter
  const rimInnerDiameter = rimDiameter - 2 * legacyInput.rimThickness
  return {
    rimDiameter,
    rimOuterDiameter: rimDiameter,
    rimInnerDiameter,
    rimThickness: input.rimThickness,
    rimHeight: input.rimHeight,
    rimLipDepth: input.rimLipDepth,
    rimStyle: input.rimStyle ?? 'circular-lip',
    rimClearance,
    rimFitClearance: rimClearance,
  }
}

export function validateRimInterface(rim: RimInterface): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (!finite(rim.rimDiameter) || rim.rimDiameter <= 0) errors.push('Rim diameter must be greater than zero.')
  if (!finite(rim.rimOuterDiameter) || rim.rimOuterDiameter <= 0) errors.push('Rim outer diameter must be greater than zero.')
  if (!finite(rim.rimInnerDiameter) || rim.rimInnerDiameter <= 0) errors.push('Rim inner diameter must be greater than zero.')
  if (!finite(rim.rimThickness) || rim.rimThickness <= 0) errors.push('Rim thickness must be greater than zero.')
  if (!finite(rim.rimHeight) || rim.rimHeight <= 0) errors.push('Rim height must be greater than zero.')
  if (!finite(rim.rimLipDepth) || rim.rimLipDepth < 0) errors.push('Rim lip depth cannot be negative.')
  if (!finite(rim.rimClearance) || rim.rimClearance < 0) errors.push('Rim clearance cannot be negative.')
  if (rim.rimStyle !== 'plain' && rim.rimStyle !== 'circular-lip') errors.push('Rim style must be plain or circular-lip.')
  if (finite(rim.rimOuterDiameter) && finite(rim.rimInnerDiameter) && rim.rimOuterDiameter <= rim.rimInnerDiameter) {
    errors.push('Rim outer diameter must be greater than inner diameter.')
  }
  if (finite(rim.rimInnerDiameter) && finite(rim.rimLipDepth) && rim.rimLipDepth >= rim.rimInnerDiameter / 2) {
    errors.push('Rim lip depth must leave a positive inner opening.')
  }
  return { valid: errors.length === 0, errors }
}

function circularProfile(_rim: RimInterface, z: number, radius: number, segments: number): ProfileRing {
  return {
    z,
    points: Array.from({ length: segments }, (_, column) => ({
      angle: (Math.PI * 2 * column) / segments,
      radius,
    })),
  }
}

export function generateRimInterface(
  rim: RimInterface,
  requestedFrame: ConnectionFrame,
  radialSegments = 64,
): RimInterfaceGeneration {
  const validation = validateRimInterface(rim)
  if (!validation.valid) throw new Error(validation.errors.join(' '))
  validateConnectionFrame(requestedFrame, 'Rim Interface input frame')
  if (!Number.isInteger(radialSegments) || radialSegments < 16) throw new Error('Rim Interface radial segments must be an integer of at least 16.')

  const bottomZ = requestedFrame.position.z
  const topZ = bottomZ + rim.rimHeight
  const outerRadius = rim.rimOuterDiameter / 2
  const innerRadius = rim.rimInnerDiameter / 2
  const hasLip = rim.rimStyle === 'circular-lip' && rim.rimLipDepth > 0
  const lipRadius = Math.max(0.1, innerRadius - (hasLip ? rim.rimLipDepth : 0))
  const profile = hasLip
    ? [
      { radius: outerRadius, z: bottomZ },
      { radius: outerRadius, z: topZ },
      { radius: lipRadius, z: topZ },
      { radius: innerRadius, z: topZ - Math.min(rim.rimLipDepth, rim.rimHeight * 0.5) },
      { radius: innerRadius, z: bottomZ },
    ]
    : [
      { radius: outerRadius, z: bottomZ },
      { radius: outerRadius, z: topZ },
      { radius: innerRadius, z: topZ },
      { radius: innerRadius, z: bottomZ },
    ]
  const mesh = generateRevolvedProfileMesh(profile, radialSegments, 'Rim Interface')
  const inputFrame = createConnectionFrame(bottomZ, outerRadius)
  const outputFrame = createConnectionFrame(topZ, outerRadius)
  validateConnectionFrame(inputFrame, 'Rim Interface input frame')
  validateConnectionFrame(outputFrame, 'Rim Interface output frame')
  return {
    mesh,
    rim,
    inputFrame,
    outputFrame,
    outerProfile: circularProfile(rim, topZ, outerRadius, radialSegments),
  }
}

export const createRimInterface = deriveRimInterface
