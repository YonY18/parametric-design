import type {
  NumberParameterDefinition,
  ParameterDefinition,
  ParameterValues,
  SelectParameterDefinition,
  ValidationResult,
} from '../parametric/types.ts'
import { generateThreadFeature, type ThreadDirection, type ThreadFeatureParameters } from './threadFeature'
import { createConnectionFrame, validateMeshData, type ConnectionFrame, type MeshData } from './types'

export interface MountProfile {
  connectionRadius: number
  bodyStartRadius: number
  innerRadius: number
  bodyStartHeight: number
}

export interface MountSupportLip {
  mesh: MeshData
  frame: ConnectionFrame
  innerDiameter: number
  outerDiameter: number
  thickness: number
  z: number
}

export interface MountGeneration {
  mesh: MeshData
  profile: MountProfile
  inputFrame: ConnectionFrame
  outputFrame: ConnectionFrame
  supportLip?: MountSupportLip
}

export interface MountDefinition<P extends ParameterValues = ParameterValues> {
  id: string
  name: string
  category: string
  parameters: readonly ParameterDefinition[]
  validate(parameters: P): ValidationResult
  generate(parameters: P): MountGeneration
}

export interface GenericThreadedMountParameters extends ParameterValues {
  outerDiameter: number
  innerDiameter: number
  height: number
  threadDiameter: number
  threadPitch: number
  threadLength: number
  threadDirection: ThreadDirection
  threadClearance: number
  wallThickness: number
  cableHoleDiameter: number
  supportLipEnabled: boolean
  supportLipInnerDiameter: number
  supportLipOuterDiameter: number
  supportLipThickness: number
  supportLipZ: number
}

export interface GenericMountPreset {
  id: string
  label: string
  parameters: GenericThreadedMountParameters
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
  id: 'threadDirection',
  label: 'Thread direction',
  description: 'Winding direction of the thread.',
  type: 'select',
  options: [
    { value: 'right', label: 'Right-hand' },
    { value: 'left', label: 'Left-hand' },
  ],
}

const genericThreadedMountParameters: readonly ParameterDefinition[] = [
  numberParameter('outerDiameter', 'Outer diameter', 'Outside diameter of the mount body.', 0.1, 300, 0.5),
  numberParameter('innerDiameter', 'Inner diameter', 'Inside diameter of the mount body.', 0.1, 300, 0.5),
  numberParameter('height', 'Mount height', 'Axial height of the mount.', 0.1, 200, 0.5),
  numberParameter('threadDiameter', 'Thread diameter', 'Nominal diameter of the threaded connection.', 0.1, 300, 0.5),
  numberParameter('threadPitch', 'Thread pitch', 'Axial distance between thread turns.', 0.01, 50, 0.1),
  numberParameter('threadLength', 'Thread length', 'Axial length of the threaded connection.', 0.01, 200, 0.5),
  directionParameter,
  numberParameter('threadClearance', 'Thread clearance', 'Radial clearance for the threaded connection.', 0, 10, 0.05),
  numberParameter('wallThickness', 'Mount wall thickness', 'Minimum radial wall around the mount opening.', 0.1, 50, 0.1),
  numberParameter('cableHoleDiameter', 'Cable hole diameter', 'Cable passage diameter through the mount.', 0, 250, 0.5),
  {
    id: 'supportLipEnabled',
    label: 'Support lip enabled',
    description: 'Generate the explicit seat that supports the shade flange.',
    type: 'boolean',
  },
  numberParameter('supportLipInnerDiameter', 'Support lip inner diameter', 'Inside diameter of the shade support seat.', 0.1, 300, 0.5),
  numberParameter('supportLipOuterDiameter', 'Support lip outer diameter', 'Outside diameter of the shade support seat.', 0.1, 300, 0.5),
  numberParameter('supportLipThickness', 'Support lip thickness', 'Axial thickness below the support plane.', 0.01, 50, 0.1),
  numberParameter('supportLipZ', 'Support lip Z', 'Z position of the upper support plane.', 0, 200, 0.5),
]

function number(parameters: GenericThreadedMountParameters, id: keyof GenericThreadedMountParameters): number {
  return Number(parameters[id])
}

export function validateGenericThreadedMount(parameters: GenericThreadedMountParameters): ValidationResult {
  const errors: string[] = []
  const outerDiameter = number(parameters, 'outerDiameter')
  const innerDiameter = number(parameters, 'innerDiameter')
  const height = number(parameters, 'height')
  const threadDiameter = number(parameters, 'threadDiameter')
  const threadPitch = number(parameters, 'threadPitch')
  const threadLength = number(parameters, 'threadLength')
  const threadClearance = number(parameters, 'threadClearance')
  const wallThickness = number(parameters, 'wallThickness')
  const cableHoleDiameter = number(parameters, 'cableHoleDiameter')
  const supportLipInnerDiameter = number(parameters, 'supportLipInnerDiameter')
  const supportLipOuterDiameter = number(parameters, 'supportLipOuterDiameter')
  const supportLipThickness = number(parameters, 'supportLipThickness')
  const supportLipZ = number(parameters, 'supportLipZ')

  if (!Number.isFinite(outerDiameter) || outerDiameter <= 0) errors.push('Mount outer diameter must be greater than zero.')
  if (!Number.isFinite(innerDiameter) || innerDiameter <= 0) errors.push('Mount inner diameter must be greater than zero.')
  if (!Number.isFinite(height) || height <= 0) errors.push('Mount height must be greater than zero.')
  if (!Number.isFinite(threadDiameter) || threadDiameter <= 0) errors.push('Thread diameter must be greater than zero.')
  if (!Number.isFinite(threadPitch) || threadPitch <= 0) errors.push('Thread pitch must be greater than zero.')
  if (!Number.isFinite(threadLength) || threadLength <= 0) errors.push('Thread length must be greater than zero.')
  if (!Number.isFinite(threadClearance) || threadClearance < 0) errors.push('Thread clearance cannot be negative.')
  if (!Number.isFinite(wallThickness) || wallThickness <= 0) errors.push('Mount wall thickness must be greater than zero.')
  if (!Number.isFinite(cableHoleDiameter) || cableHoleDiameter < 0) errors.push('Cable hole diameter cannot be negative.')
  if (typeof parameters.supportLipEnabled !== 'boolean') errors.push('Support lip enabled must be a boolean.')
  if (parameters.threadDirection !== 'right' && parameters.threadDirection !== 'left') {
    errors.push('Thread direction must be right or left.')
  }

  if (Number.isFinite(outerDiameter) && Number.isFinite(innerDiameter) && outerDiameter <= innerDiameter) {
    errors.push('Mount outer diameter must be greater than inner diameter.')
  }
  if (Number.isFinite(outerDiameter) && Number.isFinite(threadDiameter) && threadDiameter > outerDiameter) {
    errors.push('Thread diameter cannot exceed mount outer diameter.')
  }
  if (Number.isFinite(threadLength) && Number.isFinite(height) && threadLength > height) {
    errors.push('Thread length cannot exceed mount height.')
  }
  if (Number.isFinite(cableHoleDiameter) && Number.isFinite(innerDiameter) && cableHoleDiameter >= innerDiameter) {
    errors.push('Cable hole diameter must be smaller than inner diameter.')
  }
  if (
    Number.isFinite(outerDiameter) &&
    Number.isFinite(innerDiameter) &&
    Number.isFinite(wallThickness) &&
    outerDiameter - innerDiameter < wallThickness * 2
  ) {
    errors.push('Mount wall thickness is too large for the selected diameters.')
  }
  if (
    Number.isFinite(threadDiameter) &&
    Number.isFinite(innerDiameter) &&
    Number.isFinite(wallThickness) &&
    threadDiameter - innerDiameter < wallThickness * 2
  ) {
    errors.push('Mount wall thickness is insufficient around the threaded connection.')
  }
  if (Number.isFinite(threadClearance) && Number.isFinite(threadPitch) && threadClearance > threadPitch / 2) {
    errors.push('Thread clearance is too large for the selected pitch.')
  }
  if (
    Number.isFinite(threadDiameter) &&
    Number.isFinite(innerDiameter) &&
    Number.isFinite(threadPitch) &&
    Number.isFinite(threadClearance) &&
    threadDiameter > innerDiameter &&
    threadPitch > 0 &&
    threadDiameter / 2 - threadClearance - Math.min(threadPitch / 4, (threadDiameter - innerDiameter) / 4) <= innerDiameter / 2
  ) {
    errors.push('Thread profile would collapse the mount wall; increase the threaded diameter or reduce clearance.')
  }

  if (parameters.supportLipEnabled) {
    if (!Number.isFinite(supportLipInnerDiameter) || supportLipInnerDiameter <= 0) {
      errors.push('Support lip inner diameter must be greater than zero.')
    }
    if (!Number.isFinite(supportLipOuterDiameter) || supportLipOuterDiameter <= 0) {
      errors.push('Support lip outer diameter must be greater than zero.')
    }
    if (!Number.isFinite(supportLipThickness) || supportLipThickness <= 0) {
      errors.push('Support lip thickness must be greater than zero.')
    }
    if (!Number.isFinite(supportLipZ) || supportLipZ < 0) errors.push('Support lip Z cannot be negative.')
    if (Number.isFinite(supportLipOuterDiameter) && Number.isFinite(supportLipInnerDiameter)
      && supportLipOuterDiameter <= supportLipInnerDiameter) {
      errors.push('Support lip outer diameter must be greater than inner diameter.')
    }
    if (Number.isFinite(supportLipInnerDiameter) && Number.isFinite(threadDiameter)
      && supportLipInnerDiameter < threadDiameter + threadClearance * 2) {
      errors.push('Support lip inner diameter must clear the external thread.')
    }
    if (Number.isFinite(supportLipZ) && Number.isFinite(supportLipThickness)
      && supportLipThickness > supportLipZ) {
      errors.push('Support lip thickness cannot extend below the mount base.')
    }
    if (Number.isFinite(supportLipZ) && Number.isFinite(height) && supportLipZ > height) {
      errors.push('Support lip Z cannot exceed mount height.')
    }
  }

  return { valid: errors.length === 0, errors }
}

function getZExtent(mesh: MeshData): { min: number; max: number } {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (let index = 2; index < mesh.positions.length; index += 3) {
    min = Math.min(min, mesh.positions[index])
    max = Math.max(max, mesh.positions[index])
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) throw new Error('Generated mount has no finite Z extent.')
  return { min, max }
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

function createAnnularMesh(outerRadius: number, innerRadius: number, bottomZ: number, topZ: number): MeshData {
  const segments = parametersSegments
  const positions = new Float32Array(segments * 4 * 3)
  const indices: number[] = []
  const ring = (surface: number, column: number) => surface * segments + (column % segments + segments) % segments
  for (let column = 0; column < segments; column += 1) {
    const angle = Math.PI * 2 * column / segments
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const outerBottom = ring(0, column)
    const outerTop = ring(1, column)
    const innerBottom = ring(2, column)
    const innerTop = ring(3, column)
    positions[outerBottom * 3] = cos * outerRadius
    positions[outerBottom * 3 + 1] = sin * outerRadius
    positions[outerBottom * 3 + 2] = bottomZ
    positions[outerTop * 3] = cos * outerRadius
    positions[outerTop * 3 + 1] = sin * outerRadius
    positions[outerTop * 3 + 2] = topZ
    positions[innerBottom * 3] = cos * innerRadius
    positions[innerBottom * 3 + 1] = sin * innerRadius
    positions[innerBottom * 3 + 2] = bottomZ
    positions[innerTop * 3] = cos * innerRadius
    positions[innerTop * 3 + 1] = sin * innerRadius
    positions[innerTop * 3 + 2] = topZ
  }
  for (let column = 0; column < segments; column += 1) {
    const next = column + 1
    indices.push(ring(0, column), ring(0, next), ring(1, next), ring(0, column), ring(1, next), ring(1, column))
    indices.push(ring(2, column), ring(3, next), ring(2, next), ring(2, column), ring(3, column), ring(3, next))
    indices.push(ring(0, column), ring(2, next), ring(2, column), ring(0, column), ring(0, next), ring(2, next))
    indices.push(ring(1, column), ring(3, column), ring(3, next), ring(1, column), ring(3, next), ring(1, next))
  }
  const typedIndices = new Uint32Array(indices)
  const normals = new Float32Array(positions.length)
  for (let index = 0; index < typedIndices.length; index += 3) {
    addNormal(normals, positions, typedIndices[index], typedIndices[index + 1], typedIndices[index + 2])
  }
  for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
    const offset = vertex * 3
    const length = Math.hypot(normals[offset], normals[offset + 1], normals[offset + 2])
    if (!Number.isFinite(length) || length === 0) throw new Error('Generated annular mesh contains a degenerate normal.')
    normals[offset] /= length
    normals[offset + 1] /= length
    normals[offset + 2] /= length
  }
  const mesh = { positions, indices: typedIndices, normals }
  validateMeshData(mesh)
  return mesh
}

function generateGenericThreadedMountMesh(
  parameters: GenericThreadedMountParameters,
  profile: MountProfile,
): MeshData {
  const outerRadius = parameters.outerDiameter / 2
  const innerRadius = parameters.innerDiameter / 2
  const cableHoleRadius = Math.max(parameters.cableHoleDiameter / 2, 0.001)
  const thread = generateThreadFeature({
    diameter: parameters.threadDiameter,
    pitch: parameters.threadPitch,
    length: parameters.threadLength,
    profileDepth: Math.min(parameters.threadPitch / 4, (parameters.threadDiameter - parameters.innerDiameter) / 4),
    direction: parameters.threadDirection,
    internal: false,
    clearance: parameters.threadClearance,
  } satisfies ThreadFeatureParameters)
  const rows = Math.max(8, Math.ceil((parameters.threadLength / parameters.threadPitch) * 8) + 1)
  const ringVertexCount = (rows + 1) * 2
  const positions = new Float32Array(ringVertexCount * parametersSegments * 3)
  const indices: number[] = []
  const rowIndex = (row: number, column: number) => row * parametersSegments + (column % parametersSegments + parametersSegments) % parametersSegments
  const innerIndex = (row: number, column: number) => (rows + 1) * parametersSegments + rowIndex(row, column)

  for (let row = 0; row <= rows; row += 1) {
    const z = (parameters.height * row) / rows
    const inThread = z > profile.bodyStartHeight
    const distance = Math.max(0, z - profile.bodyStartHeight)
    for (let column = 0; column < parametersSegments; column += 1) {
      const angle = (Math.PI * 2 * column) / parametersSegments
      const radius = inThread ? thread.radiusAt(distance, angle) : outerRadius
      const cavityRadius = row === 0 ? cableHoleRadius : innerRadius
      const outer = rowIndex(row, column)
      const inner = innerIndex(row, column)
      positions[outer * 3] = Math.cos(angle) * radius
      positions[outer * 3 + 1] = Math.sin(angle) * radius
      positions[outer * 3 + 2] = z
      positions[inner * 3] = Math.cos(angle) * cavityRadius
      positions[inner * 3 + 1] = Math.sin(angle) * cavityRadius
      positions[inner * 3 + 2] = z
    }
  }

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < parametersSegments; column += 1) {
      const next = column + 1
      const outer = rowIndex(row, column)
      const outerNext = rowIndex(row, next)
      const outerUp = rowIndex(row + 1, column)
      const outerUpNext = rowIndex(row + 1, next)
      const inner = innerIndex(row, column)
      const innerNext = innerIndex(row, next)
      const innerUp = innerIndex(row + 1, column)
      const innerUpNext = innerIndex(row + 1, next)
      indices.push(outer, outerUp, outerUpNext, outer, outerUpNext, outerNext)
      indices.push(inner, innerNext, innerUpNext, inner, innerUpNext, innerUp)
    }
  }
  for (let column = 0; column < parametersSegments; column += 1) {
    const next = column + 1
    indices.push(rowIndex(0, column), innerIndex(0, column), innerIndex(0, next))
    indices.push(rowIndex(0, column), innerIndex(0, next), rowIndex(0, next))
    indices.push(rowIndex(rows, column), rowIndex(rows, next), innerIndex(rows, next))
    indices.push(rowIndex(rows, column), innerIndex(rows, next), innerIndex(rows, column))
  }

  const typedIndices = new Uint32Array(indices)
  const normals = new Float32Array(positions.length)
  for (let index = 0; index < typedIndices.length; index += 3) {
    addNormal(normals, positions, typedIndices[index], typedIndices[index + 1], typedIndices[index + 2])
  }
  for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
    const offset = vertex * 3
    const length = Math.hypot(normals[offset], normals[offset + 1], normals[offset + 2])
    if (!Number.isFinite(length) || length === 0) throw new Error('Generated mount contains a degenerate normal.')
    normals[offset] /= length
    normals[offset + 1] /= length
    normals[offset + 2] /= length
  }

  const mesh = { positions, indices: typedIndices, normals }
  validateMeshData(mesh)
  return mesh
}

const parametersSegments = 64

export const genericMountPresets: readonly GenericMountPreset[] = [
  {
    id: '60',
    label: 'Generic 60 mm',
    parameters: {
      outerDiameter: 60,
      innerDiameter: 30,
      height: 24,
      threadDiameter: 40,
      threadPitch: 2,
      threadLength: 12,
      threadDirection: 'right',
      threadClearance: 0.2,
      wallThickness: 3,
      cableHoleDiameter: 10,
      supportLipEnabled: true,
      supportLipInnerDiameter: 42,
      supportLipOuterDiameter: 60,
      supportLipThickness: 2,
      supportLipZ: 12,
    },
  },
  {
    id: '70',
    label: 'Generic 70 mm',
    parameters: {
      outerDiameter: 70,
      innerDiameter: 40,
      height: 24,
      threadDiameter: 50,
      threadPitch: 2,
      threadLength: 12,
      threadDirection: 'right',
      threadClearance: 0.2,
      wallThickness: 3,
      cableHoleDiameter: 10,
      supportLipEnabled: true,
      supportLipInnerDiameter: 52,
      supportLipOuterDiameter: 70,
      supportLipThickness: 2,
      supportLipZ: 12,
    },
  },
  {
    id: '80',
    label: 'Generic 80 mm',
    parameters: {
      outerDiameter: 80,
      innerDiameter: 50,
      height: 24,
      threadDiameter: 60,
      threadPitch: 2,
      threadLength: 12,
      threadDirection: 'right',
      threadClearance: 0.2,
      wallThickness: 3,
      cableHoleDiameter: 10,
      supportLipEnabled: true,
      supportLipInnerDiameter: 62,
      supportLipOuterDiameter: 80,
      supportLipThickness: 2,
      supportLipZ: 12,
    },
  },
]

export const genericThreadedMount: MountDefinition<GenericThreadedMountParameters> = {
  id: 'generic-threaded',
  name: 'Generic Threaded Mount',
  category: 'Mounts',
  parameters: genericThreadedMountParameters,
  validate: validateGenericThreadedMount,
  generate(parameters) {
    const validation = validateGenericThreadedMount(parameters)
    if (!validation.valid) throw new Error(validation.errors.join(' '))
    const profile: MountProfile = {
      connectionRadius: parameters.threadDiameter / 2 - parameters.threadClearance,
      bodyStartRadius: parameters.outerDiameter / 2,
      innerRadius: parameters.innerDiameter / 2,
      bodyStartHeight: parameters.height - parameters.threadLength,
    }
    const mesh = generateGenericThreadedMountMesh(parameters, profile)
    const extent = getZExtent(mesh)
    const supportLip = parameters.supportLipEnabled ? {
      mesh: createAnnularMesh(
        parameters.supportLipOuterDiameter / 2,
        parameters.supportLipInnerDiameter / 2,
        parameters.supportLipZ - parameters.supportLipThickness,
        parameters.supportLipZ,
      ),
      frame: createConnectionFrame(parameters.supportLipZ, parameters.supportLipOuterDiameter / 2),
      innerDiameter: parameters.supportLipInnerDiameter,
      outerDiameter: parameters.supportLipOuterDiameter,
      thickness: parameters.supportLipThickness,
      z: parameters.supportLipZ,
    } : undefined
    return {
      mesh,
      profile,
      supportLip,
      inputFrame: createConnectionFrame(extent.min, profile.bodyStartRadius),
      outputFrame: createConnectionFrame(profile.bodyStartHeight, profile.bodyStartRadius),
    }
  },
}

export const genericThreadedMountDefinition = genericThreadedMount
export const genericThreadedMountPresets = genericMountPresets
export const mountDefinitions: readonly MountDefinition[] = [genericThreadedMount]
