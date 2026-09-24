import type {
  NumberParameterDefinition,
  ParameterDefinition,
  SelectParameterDefinition,
  ValidationResult,
} from '../parametric/types'
import { validateConnectionFrame } from './assembly'
import { generateThreadFeature, type ThreadDirection } from './threadFeature'
import { threadSpecFromLegacy, validateThreadSpec, type ThreadProfileType, type ThreadSpec } from './threadSpec'
import { createConnectionFrame, validateMeshData, type ConnectionFrame, type MeshData } from './types'

export type RetainingGripStyle = 'smooth' | 'ribs' | 'scalloped'

export interface RetainingRingParameters {
  [key: string]: unknown
  outerDiameter: number
  innerDiameter: number
  height: number
  wallThickness: number
  threadSpec?: ThreadSpec
  threadDiameter?: number
  threadPitch?: number
  threadLength?: number
  threadClearance?: number
  threadDirection?: ThreadDirection
  gripStyle: RetainingGripStyle
  gripDepth: number
  gripCount: number
}

export interface RetainingRingGeneration {
  mesh: MeshData
  inputFrame: ConnectionFrame
  outputFrame: ConnectionFrame
  pressureFaceFrame: ConnectionFrame
  internalThread: {
    diameter: number
    pitch: number
    length: number
    depth: number
    clearance: number
    direction: ThreadDirection
    profileType: ThreadProfileType
    internal: true
  }
}

export interface RetainingRingDefinition {
  id: string
  name: string
  category: string
  parameters: readonly ParameterDefinition[]
  validate(parameters: RetainingRingParameters): ValidationResult
  generate(parameters: RetainingRingParameters, inputFrame?: ConnectionFrame): RetainingRingGeneration
}

const numberParameter = (
  id: string,
  label: string,
  description: string,
  min: number,
  max: number,
  step: number,
): NumberParameterDefinition => ({ id, label, description, type: 'number', unit: 'mm', min, max, step })

const gripStyleParameter: SelectParameterDefinition = {
  id: 'gripStyle',
  label: 'Grip style',
  description: 'Outer grip detail on the retaining ring.',
  type: 'select',
  options: [
    { value: 'smooth', label: 'Smooth' },
    { value: 'ribs', label: 'Ribs' },
    { value: 'scalloped', label: 'Scalloped' },
  ],
}

const threadDirectionParameter: SelectParameterDefinition = {
  id: 'threadDirection',
  label: 'Thread direction',
  description: 'Must match the mount external thread direction.',
  type: 'select',
  options: [
    { value: 'right', label: 'Right-hand' },
    { value: 'left', label: 'Left-hand' },
  ],
}

const retainingRingParameters: readonly ParameterDefinition[] = [
  numberParameter('outerDiameter', 'Outer diameter', 'Outside diameter of the retaining ring.', 0.1, 300, 0.5),
  numberParameter('innerDiameter', 'Inner diameter', 'Maximum bore diameter around the internal thread profile.', 0.1, 300, 0.5),
  numberParameter('height', 'Height', 'Axial height of the retaining ring.', 0.1, 100, 0.5),
  numberParameter('wallThickness', 'Wall thickness', 'Minimum radial wall around the threaded bore.', 0.1, 50, 0.1),
  numberParameter('threadDiameter', 'Thread diameter', 'Nominal diameter matching the mount external thread.', 0.1, 300, 0.5),
  numberParameter('threadPitch', 'Thread pitch', 'Pitch matching the mount external thread.', 0.01, 50, 0.1),
  numberParameter('threadLength', 'Thread length', 'Length of the internal threaded section.', 0.01, 100, 0.5),
  numberParameter('threadClearance', 'Thread clearance', 'Radial clearance for the internal thread.', 0, 10, 0.05),
  threadDirectionParameter,
  gripStyleParameter,
  numberParameter('gripDepth', 'Grip depth', 'Radial depth of the grip detail.', 0, 20, 0.1),
  numberParameter('gripCount', 'Grip count', 'Number of ribs or scallops around the ring.', 3, 128, 1),
]

function resolveSpec(parameters: RetainingRingParameters): ThreadSpec {
  return parameters.threadSpec ?? threadSpecFromLegacy({
    nominalDiameter: Number(parameters.threadDiameter),
    pitch: Number(parameters.threadPitch),
    length: Number(parameters.threadLength),
    clearance: Number(parameters.threadClearance),
    handedness: parameters.threadDirection,
  })
}

export function validateRetainingRing(parameters: RetainingRingParameters): ValidationResult {
  const errors: string[] = []
  let spec: ThreadSpec
  try {
    spec = resolveSpec(parameters)
  } catch (error) {
    return { valid: false, errors: [error instanceof Error ? error.message : 'Retaining ring thread specification is invalid.'] }
  }
  errors.push(...validateThreadSpec(spec).errors)
  const values = {
    outerDiameter: Number(parameters.outerDiameter),
    innerDiameter: Number(parameters.innerDiameter),
    height: Number(parameters.height),
    wallThickness: Number(parameters.wallThickness),
    gripDepth: Number(parameters.gripDepth),
    gripCount: Number(parameters.gripCount),
  }
  if (!Number.isFinite(values.outerDiameter) || values.outerDiameter <= 0) errors.push('Retaining ring outer diameter must be greater than zero.')
  if (!Number.isFinite(values.innerDiameter) || values.innerDiameter <= 0) errors.push('Retaining ring inner diameter must be greater than zero.')
  if (!Number.isFinite(values.height) || values.height <= 0) errors.push('Retaining ring height must be greater than zero.')
  if (!Number.isFinite(values.wallThickness) || values.wallThickness <= 0) errors.push('Retaining ring wall thickness must be greater than zero.')
  if (!Number.isFinite(values.gripDepth) || values.gripDepth < 0) errors.push('Retaining ring grip depth cannot be negative.')
  if (!Number.isInteger(values.gripCount) || values.gripCount < 3) errors.push('Retaining ring grip count must be an integer of at least 3.')
  if (!parameters.threadSpec && parameters.threadDirection !== 'right' && parameters.threadDirection !== 'left') {
    errors.push('Retaining ring thread direction must be right or left.')
  }
  if (!['smooth', 'ribs', 'scalloped'].includes(String(parameters.gripStyle))) errors.push('Retaining ring grip style must be smooth, ribs, or scalloped.')
  if (Number.isFinite(values.outerDiameter) && Number.isFinite(values.innerDiameter)
    && values.outerDiameter <= values.innerDiameter) errors.push('Retaining ring outer diameter must be greater than inner diameter.')
  const maximumThreadDiameter = spec.nominalDiameter + 2 * (spec.clearance + spec.depth)
  if (Number.isFinite(values.innerDiameter) && values.innerDiameter < maximumThreadDiameter) {
    errors.push('Retaining ring inner diameter must leave room for the internal thread profile.')
  }
  if (Number.isFinite(values.outerDiameter) && Number.isFinite(values.innerDiameter)
    && Number.isFinite(values.wallThickness)
    && values.outerDiameter - values.innerDiameter < values.wallThickness * 2) {
    errors.push('Retaining ring wall thickness is too large for the selected diameters.')
  }
  if (Number.isFinite(values.outerDiameter) && Number.isFinite(spec.nominalDiameter)
    && Number.isFinite(values.gripDepth) && values.gripDepth >= (values.outerDiameter - spec.nominalDiameter) / 2) {
    errors.push('Retaining ring grip depth would collapse the outer wall.')
  }
  if (Number.isFinite(values.height) && spec.length > values.height) errors.push('Retaining ring thread length cannot exceed ring height.')
  if (Number.isFinite(spec.nominalDiameter) && Number.isFinite(values.outerDiameter)
    && spec.nominalDiameter + spec.clearance * 2 >= values.outerDiameter) {
    errors.push('Retaining ring outer diameter must leave room around the internal thread.')
  }
  return { valid: errors.length === 0, errors }
}

const segments = 64

function addNormal(normals: number[], positions: number[], a: number, b: number, c: number): void {
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

function gripRadius(parameters: RetainingRingParameters, angle: number): number {
  const outerRadius = parameters.outerDiameter / 2
  const depth = parameters.gripDepth
  if (parameters.gripStyle === 'smooth' || depth === 0) return outerRadius
  const baseWave = (1 + Math.cos(angle * parameters.gripCount)) / 2
  const wave = parameters.gripStyle === 'ribs' ? baseWave : Math.sqrt(baseWave)
  return outerRadius - depth * (1 - wave)
}

function generateRingMesh(
  parameters: RetainingRingParameters,
  frame: ConnectionFrame,
  threadRadiusAt: (z: number, angle: number) => number,
  pitch: number,
  threadLength: number,
): MeshData {
  const positions: number[] = []
  const indices: number[] = []
  const ring = (surface: number, column: number) => surface * segments + (column % segments + segments) % segments
  const pushVertex = (radius: number, angle: number, z: number) => {
    positions.push(Math.cos(angle) * radius, Math.sin(angle) * radius, z)
  }
  for (let surface = 0; surface < 4; surface += 1) {
    for (let column = 0; column < segments; column += 1) {
      const angle = Math.PI * 2 * column / segments
      const radius = surface < 2 ? gripRadius(parameters, angle) : parameters.innerDiameter / 2
      const z = surface % 2 === 0 ? frame.position.z : frame.position.z + parameters.height
      pushVertex(radius, angle, z)
    }
  }
  for (let column = 0; column < segments; column += 1) {
    const next = column + 1
    indices.push(ring(0, column), ring(0, next), ring(1, next), ring(0, column), ring(1, next), ring(1, column))
    indices.push(ring(2, column), ring(3, next), ring(2, next), ring(2, column), ring(3, column), ring(3, next))
    indices.push(ring(0, column), ring(2, next), ring(2, column), ring(0, column), ring(0, next), ring(2, next))
    indices.push(ring(1, column), ring(3, column), ring(3, next), ring(1, column), ring(3, next), ring(1, next))
  }

  const threadStart = positions.length / 3
  const effectiveThreadLength = Math.min(parameters.height, threadLength)
  const rows = Math.max(8, Math.ceil(effectiveThreadLength / pitch * 12) + 1)
  for (let row = 0; row < rows; row += 1) {
    const distance = effectiveThreadLength * row / (rows - 1)
    const z = frame.position.z + distance
    for (let column = 0; column < segments; column += 1) {
      const angle = Math.PI * 2 * column / segments
      pushVertex(threadRadiusAt(distance, angle), angle, z)
    }
  }
  const threadIndex = (row: number, column: number) => threadStart + row * segments + (column % segments + segments) % segments
  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < segments; column += 1) {
      const next = column + 1
      indices.push(threadIndex(row, column), threadIndex(row + 1, next), threadIndex(row, next))
      indices.push(threadIndex(row, column), threadIndex(row + 1, column), threadIndex(row + 1, next))
    }
  }

  const typedPositions = new Float32Array(positions)
  const typedIndices = new Uint32Array(indices)
  const normalValues = new Array<number>(typedPositions.length).fill(0)
  for (let index = 0; index < typedIndices.length; index += 3) {
    addNormal(normalValues, positions, typedIndices[index], typedIndices[index + 1], typedIndices[index + 2])
  }
  const normals = new Float32Array(typedPositions.length)
  for (let vertex = 0; vertex < typedPositions.length / 3; vertex += 1) {
    const offset = vertex * 3
    const length = Math.hypot(normalValues[offset], normalValues[offset + 1], normalValues[offset + 2])
    if (!Number.isFinite(length) || length === 0) throw new Error('Generated retaining ring contains a degenerate normal.')
    normals[offset] = normalValues[offset] / length
    normals[offset + 1] = normalValues[offset + 1] / length
    normals[offset + 2] = normalValues[offset + 2] / length
  }
  const mesh = { positions: typedPositions, indices: typedIndices, normals }
  validateMeshData(mesh)
  return mesh
}

export const retainingRingDefinition: RetainingRingDefinition = {
  id: 'retaining-ring',
  name: 'Retaining Ring',
  category: 'Mechanical Interface',
  parameters: retainingRingParameters,
  validate: validateRetainingRing,
  generate(parameters, requestedFrame) {
    const validation = validateRetainingRing(parameters)
    if (!validation.valid) throw new Error(validation.errors.join(' '))
    const frame = requestedFrame ?? createConnectionFrame(0, parameters.outerDiameter / 2)
    validateConnectionFrame(frame, 'Retaining ring pressure face')
    const spec = resolveSpec(parameters)
    const thread = generateThreadFeature({ threadSpec: spec, internal: true })
    const threadRadiusAt = (z: number, angle: number): number => z <= spec.length
      ? thread.radiusAt(Math.max(0, z), angle)
      : parameters.innerDiameter / 2
    const mesh = generateRingMesh(parameters, frame, threadRadiusAt, spec.pitch, spec.length)
    const outputFrame = createConnectionFrame(frame.position.z + parameters.height, parameters.outerDiameter / 2)
    return {
      mesh,
      inputFrame: frame,
      outputFrame,
      pressureFaceFrame: frame,
      internalThread: {
        diameter: spec.nominalDiameter,
        pitch: spec.pitch,
        length: spec.length,
        depth: spec.depth,
        clearance: spec.clearance,
        direction: spec.handedness,
        profileType: spec.profileType,
        internal: true,
      },
    }
  },
}

export const retainingRing = retainingRingDefinition
