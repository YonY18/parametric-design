import type {
  NumberParameterDefinition,
  ParameterDefinition,
  ParameterValues,
  SelectParameterDefinition,
  ValidationResult,
} from '../parametric/types'
import { validateConnectionFrame } from './assembly'
import { generateThreadFeature, type ThreadDirection } from './threadFeature'
import { createConnectionFrame, validateMeshData, type ConnectionFrame, type MeshData } from './types'

export type RetainingGripStyle = 'smooth' | 'ribs' | 'scalloped'

export interface RetainingRingParameters extends ParameterValues {
  outerDiameter: number
  innerDiameter: number
  height: number
  wallThickness: number
  threadDiameter: number
  threadPitch: number
  threadLength: number
  threadClearance: number
  threadDirection: ThreadDirection
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
    clearance: number
    direction: ThreadDirection
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
  numberParameter('innerDiameter', 'Inner diameter', 'Nominal bore diameter before the internal thread profile.', 0.1, 300, 0.5),
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

export function validateRetainingRing(parameters: RetainingRingParameters): ValidationResult {
  const errors: string[] = []
  const values = {
    outerDiameter: Number(parameters.outerDiameter),
    innerDiameter: Number(parameters.innerDiameter),
    height: Number(parameters.height),
    wallThickness: Number(parameters.wallThickness),
    threadDiameter: Number(parameters.threadDiameter),
    threadPitch: Number(parameters.threadPitch),
    threadLength: Number(parameters.threadLength),
    threadClearance: Number(parameters.threadClearance),
    gripDepth: Number(parameters.gripDepth),
    gripCount: Number(parameters.gripCount),
  }
  if (!Number.isFinite(values.outerDiameter) || values.outerDiameter <= 0) errors.push('Retaining ring outer diameter must be greater than zero.')
  if (!Number.isFinite(values.innerDiameter) || values.innerDiameter <= 0) errors.push('Retaining ring inner diameter must be greater than zero.')
  if (!Number.isFinite(values.height) || values.height <= 0) errors.push('Retaining ring height must be greater than zero.')
  if (!Number.isFinite(values.wallThickness) || values.wallThickness <= 0) errors.push('Retaining ring wall thickness must be greater than zero.')
  if (!Number.isFinite(values.threadDiameter) || values.threadDiameter <= 0) errors.push('Retaining ring thread diameter must be greater than zero.')
  if (!Number.isFinite(values.threadPitch) || values.threadPitch <= 0) errors.push('Retaining ring thread pitch must be greater than zero.')
  if (!Number.isFinite(values.threadLength) || values.threadLength <= 0) errors.push('Retaining ring thread length must be greater than zero.')
  if (!Number.isFinite(values.threadClearance) || values.threadClearance < 0) errors.push('Retaining ring thread clearance cannot be negative.')
  if (!Number.isFinite(values.gripDepth) || values.gripDepth < 0) errors.push('Retaining ring grip depth cannot be negative.')
  if (!Number.isInteger(values.gripCount) || values.gripCount < 3) errors.push('Retaining ring grip count must be an integer of at least 3.')
  if (parameters.threadDirection !== 'right' && parameters.threadDirection !== 'left') errors.push('Retaining ring thread direction must be right or left.')
  if (!['smooth', 'ribs', 'scalloped'].includes(String(parameters.gripStyle))) errors.push('Retaining ring grip style must be smooth, ribs, or scalloped.')
  if (Number.isFinite(values.outerDiameter) && Number.isFinite(values.innerDiameter)
    && values.outerDiameter <= values.innerDiameter) errors.push('Retaining ring outer diameter must be greater than inner diameter.')
  if (Number.isFinite(values.innerDiameter) && Number.isFinite(values.threadDiameter)
    && values.innerDiameter < values.threadDiameter) errors.push('Retaining ring inner diameter cannot be smaller than its thread diameter.')
  if (Number.isFinite(values.outerDiameter) && Number.isFinite(values.innerDiameter)
    && Number.isFinite(values.wallThickness)
    && values.outerDiameter - values.innerDiameter < values.wallThickness * 2) {
    errors.push('Retaining ring wall thickness is too large for the selected diameters.')
  }
  if (Number.isFinite(values.outerDiameter) && Number.isFinite(values.threadDiameter)
    && Number.isFinite(values.gripDepth) && values.gripDepth >= (values.outerDiameter - values.threadDiameter) / 2) {
    errors.push('Retaining ring grip depth would collapse the outer wall.')
  }
  if (Number.isFinite(values.threadLength) && Number.isFinite(values.height) && values.threadLength > values.height) {
    errors.push('Retaining ring thread length cannot exceed ring height.')
  }
  if (Number.isFinite(values.threadClearance) && Number.isFinite(values.threadPitch)
    && values.threadClearance > values.threadPitch / 2) errors.push('Retaining ring thread clearance is too large for the selected pitch.')
  if (Number.isFinite(values.threadDiameter) && Number.isFinite(values.outerDiameter)
    && values.threadDiameter + values.threadClearance * 2 >= values.outerDiameter) {
    errors.push('Retaining ring outer diameter must leave room around the internal thread.')
  }
  return { valid: errors.length === 0, errors }
}

const segments = 64

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

function gripRadius(parameters: RetainingRingParameters, angle: number): number {
  const outerRadius = parameters.outerDiameter / 2
  const depth = parameters.gripDepth
  if (parameters.gripStyle === 'smooth' || depth === 0) return outerRadius
  const baseWave = (1 + Math.cos(angle * parameters.gripCount)) / 2
  const wave = parameters.gripStyle === 'ribs' ? baseWave : Math.sqrt(baseWave)
  return outerRadius - depth * (1 - wave)
}

function generateRingMesh(parameters: RetainingRingParameters, frame: ConnectionFrame, threadRadiusAt: (z: number, angle: number) => number): MeshData {
  const positions = new Float32Array(segments * 4 * 3)
  const indices: number[] = []
  const ring = (surface: number, column: number) => surface * segments + (column % segments + segments) % segments
  for (let column = 0; column < segments; column += 1) {
    const angle = Math.PI * 2 * column / segments
    const outerBottom = ring(0, column)
    const outerTop = ring(1, column)
    const innerBottom = ring(2, column)
    const innerTop = ring(3, column)
    const outerRadius = gripRadius(parameters, angle)
    const innerBottomRadius = threadRadiusAt(0, angle)
    const innerTopRadius = threadRadiusAt(parameters.height, angle)
    positions[outerBottom * 3] = Math.cos(angle) * outerRadius
    positions[outerBottom * 3 + 1] = Math.sin(angle) * outerRadius
    positions[outerBottom * 3 + 2] = frame.position.z
    positions[outerTop * 3] = Math.cos(angle) * outerRadius
    positions[outerTop * 3 + 1] = Math.sin(angle) * outerRadius
    positions[outerTop * 3 + 2] = frame.position.z + parameters.height
    positions[innerBottom * 3] = Math.cos(angle) * innerBottomRadius
    positions[innerBottom * 3 + 1] = Math.sin(angle) * innerBottomRadius
    positions[innerBottom * 3 + 2] = frame.position.z
    positions[innerTop * 3] = Math.cos(angle) * innerTopRadius
    positions[innerTop * 3 + 1] = Math.sin(angle) * innerTopRadius
    positions[innerTop * 3 + 2] = frame.position.z + parameters.height
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
  for (let index = 0; index < typedIndices.length; index += 3) addNormal(normals, positions, typedIndices[index], typedIndices[index + 1], typedIndices[index + 2])
  for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
    const offset = vertex * 3
    const length = Math.hypot(normals[offset], normals[offset + 1], normals[offset + 2])
    if (!Number.isFinite(length) || length === 0) throw new Error('Generated retaining ring contains a degenerate normal.')
    normals[offset] /= length
    normals[offset + 1] /= length
    normals[offset + 2] /= length
  }
  const mesh = { positions, indices: typedIndices, normals }
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
    const thread = generateThreadFeature({
      diameter: parameters.threadDiameter,
      pitch: parameters.threadPitch,
      length: parameters.threadLength,
      profileDepth: Math.min(parameters.threadPitch / 4, parameters.threadDiameter / 8),
      direction: parameters.threadDirection,
      internal: true,
      clearance: parameters.threadClearance,
    })
    const threadRadiusAt = (z: number, angle: number): number => z <= parameters.threadLength
      ? thread.radiusAt(Math.max(0, z), angle)
      : parameters.innerDiameter / 2
    const mesh = generateRingMesh(parameters, frame, threadRadiusAt)
    const outputFrame = createConnectionFrame(frame.position.z + parameters.height, parameters.outerDiameter / 2)
    return {
      mesh,
      inputFrame: frame,
      outputFrame,
      pressureFaceFrame: frame,
      internalThread: {
        diameter: parameters.threadDiameter,
        pitch: parameters.threadPitch,
        length: parameters.threadLength,
        clearance: parameters.threadClearance,
        direction: parameters.threadDirection,
        internal: true,
      },
    }
  },
}

export const retainingRing = retainingRingDefinition
