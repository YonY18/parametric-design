import type { ParameterValues } from '../parametric/types'
import { validateConnectionFrame } from './assembly'
import { createConnectionFrame, validateMeshData, type ConnectionFrame, type MeshData, type ProfileRing } from './types'

export type InternalShadeSupportType = 'annular' | '3-arm' | '4-arm'

export interface InternalShadeSupportParameters extends ParameterValues {
  supportType: InternalShadeSupportType
  supportInset: number
  supportThickness: number
  hubOuterDiameter: number
  shadeWallThickness: number
  radialSegments: number
}

export interface InternalShadeSupportGeneration {
  mesh: MeshData
  supportZ: number
  innerRadius: number
  outerProfile: ProfileRing
  inputFrame: ConnectionFrame
  outputFrame: ConnectionFrame
}

const hubClearance = 0.25

function number(parameters: InternalShadeSupportParameters, id: keyof InternalShadeSupportParameters): number {
  return Number(parameters[id])
}

export function validateInternalShadeSupport(
  parameters: InternalShadeSupportParameters,
  profile?: ProfileRing,
): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  const supportInset = number(parameters, 'supportInset')
  const supportThickness = number(parameters, 'supportThickness')
  const hubOuterDiameter = number(parameters, 'hubOuterDiameter')
  const shadeWallThickness = number(parameters, 'shadeWallThickness')
  const radialSegments = number(parameters, 'radialSegments')

  if (parameters.supportType !== 'annular') {
    errors.push(`Internal Shade Support type "${String(parameters.supportType)}" is not implemented; only annular is supported.`)
  }
  if (!Number.isFinite(supportInset) || supportInset <= 0) errors.push('Internal Shade Support inset must be greater than zero.')
  if (!Number.isFinite(supportThickness) || supportThickness <= 0) errors.push('Internal Shade Support thickness must be greater than zero.')
  if (!Number.isFinite(hubOuterDiameter) || hubOuterDiameter <= 0) errors.push('Internal Shade Support hub diameter must be greater than zero.')
  if (!Number.isFinite(shadeWallThickness) || shadeWallThickness <= 0) errors.push('Internal Shade Support shade wall thickness must be greater than zero.')
  if (!Number.isInteger(radialSegments) || radialSegments < 16) errors.push('Internal Shade Support radial segments must be an integer of at least 16.')

  if (profile) {
    const innerRadius = hubOuterDiameter / 2 + hubClearance
    for (const point of profile.points) {
      const interiorRadius = point.radius - shadeWallThickness
      if (!Number.isFinite(interiorRadius) || interiorRadius <= 0) {
        errors.push('Internal Shade Support profile contains a non-positive interior radius.')
        break
      }
      if (Number.isFinite(innerRadius) && interiorRadius <= innerRadius) {
        errors.push('Internal Shade Support hub opening leaves no annular plate material at the shade profile.')
        break
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

function addNormal(normals: Float32Array, positions: Float32Array, a: number, b: number, c: number): void {
  const ax = positions[a * 3]
  const ay = positions[a * 3 + 1]
  const az = positions[a * 3 + 2]
  const abx = positions[b * 3] - ax
  const aby = positions[b * 3 + 1] - ay
  const abz = positions[b * 3 + 2] - az
  const acx = positions[c * 3] - ax
  const acy = positions[c * 3 + 1] - ay
  const acz = positions[c * 3 + 2] - az
  const nx = aby * acz - abz * acy
  const ny = abz * acx - abx * acz
  const nz = abx * acy - aby * acx
  for (const vertex of [a, b, c]) {
    normals[vertex * 3] += nx
    normals[vertex * 3 + 1] += ny
    normals[vertex * 3 + 2] += nz
  }
}

function generateAnnularSupportMesh(
  outerProfile: ProfileRing,
  innerRadius: number,
  bottomZ: number,
  topZ: number,
): MeshData {
  const segments = outerProfile.points.length
  const positions = new Float32Array(segments * 4 * 3)
  const indices: number[] = []
  const ring = (surface: number, column: number) => surface * segments + (column % segments + segments) % segments

  for (let column = 0; column < segments; column += 1) {
    const outerPoint = outerProfile.points[column]
    const outerBottom = ring(0, column)
    const outerTop = ring(1, column)
    const innerBottom = ring(2, column)
    const innerTop = ring(3, column)
    const outerX = Math.cos(outerPoint.angle) * outerPoint.radius
    const outerY = Math.sin(outerPoint.angle) * outerPoint.radius
    const innerAngle = (Math.PI * 2 * column) / segments
    const innerX = Math.cos(innerAngle) * innerRadius
    const innerY = Math.sin(innerAngle) * innerRadius

    positions[outerBottom * 3] = outerX
    positions[outerBottom * 3 + 1] = outerY
    positions[outerBottom * 3 + 2] = bottomZ
    positions[outerTop * 3] = outerX
    positions[outerTop * 3 + 1] = outerY
    positions[outerTop * 3 + 2] = topZ
    positions[innerBottom * 3] = innerX
    positions[innerBottom * 3 + 1] = innerY
    positions[innerBottom * 3 + 2] = bottomZ
    positions[innerTop * 3] = innerX
    positions[innerTop * 3 + 1] = innerY
    positions[innerTop * 3 + 2] = topZ
  }

  for (let column = 0; column < segments; column += 1) {
    const next = column + 1
    // No outer side wall: the support edge sits on the shade inner wall instead of duplicating a coplanar face.
    indices.push(ring(2, column), ring(3, next), ring(3, column), ring(2, column), ring(2, next), ring(3, next))
    indices.push(ring(1, column), ring(3, column), ring(3, next), ring(1, column), ring(3, next), ring(1, next))
    indices.push(ring(0, column), ring(2, next), ring(2, column), ring(0, column), ring(0, next), ring(2, next))
  }

  const typedIndices = new Uint32Array(indices)
  const normals = new Float32Array(positions.length)
  for (let index = 0; index < typedIndices.length; index += 3) {
    addNormal(normals, positions, typedIndices[index], typedIndices[index + 1], typedIndices[index + 2])
  }
  for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
    const offset = vertex * 3
    const length = Math.hypot(normals[offset], normals[offset + 1], normals[offset + 2])
    if (!Number.isFinite(length) || length === 0) throw new Error('Generated Internal Shade Support contains a degenerate normal.')
    normals[offset] /= length
    normals[offset + 1] /= length
    normals[offset + 2] /= length
  }

  const mesh = { positions, indices: typedIndices, normals }
  validateMeshData(mesh)
  return mesh
}

export function generateInternalShadeSupport(
  parameters: InternalShadeSupportParameters,
  outerProfile: ProfileRing,
  shadeStartZ: number,
): InternalShadeSupportGeneration {
  const validation = validateInternalShadeSupport(parameters, outerProfile)
  if (!validation.valid) throw new Error(validation.errors.join(' '))
  const supportInset = number(parameters, 'supportInset')
  const supportThickness = number(parameters, 'supportThickness')
  const hubOuterDiameter = number(parameters, 'hubOuterDiameter')
  const shadeWallThickness = number(parameters, 'shadeWallThickness')
  if (!Number.isFinite(shadeStartZ)) throw new Error('Internal Shade Support shade start Z must be finite.')
  if (!Number.isFinite(outerProfile.z)) throw new Error('Internal Shade Support profile Z must be finite.')
  if (Math.abs(outerProfile.z - (shadeStartZ + supportInset)) > 1e-5) {
    throw new Error('Internal Shade Support profile Z must match supportInset from the shade mounting end.')
  }

  const innerRadius = hubOuterDiameter / 2 + hubClearance
  const innerProfile: ProfileRing = {
    z: outerProfile.z,
    points: outerProfile.points.map((point) => ({
      angle: point.angle,
      radius: point.radius - shadeWallThickness,
    })),
  }
  const maxRadius = Math.max(...innerProfile.points.map((point) => point.radius))
  const supportZ = outerProfile.z
  const inputFrame = createConnectionFrame(supportZ, maxRadius)
  const outputFrame = createConnectionFrame(supportZ + supportThickness, maxRadius)
  validateConnectionFrame(inputFrame, 'Internal Shade Support input frame')
  validateConnectionFrame(outputFrame, 'Internal Shade Support output frame')

  return {
    mesh: generateAnnularSupportMesh(innerProfile, innerRadius, supportZ, outputFrame.position.z),
    supportZ,
    innerRadius,
    outerProfile: innerProfile,
    inputFrame,
    outputFrame,
  }
}
