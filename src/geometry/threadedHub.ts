import type { ParameterValues } from '../parametric/types'
import { validateConnectionFrame } from './assembly'
import { createConnectionFrame, validateMeshData, type ConnectionFrame, type MeshData } from './types'
import type { ThreadDirection } from './threadFeature'

export interface ThreadedHubParameters extends ParameterValues {
  hubOuterDiameter: number
  hubHeight: number
  hubWallThickness: number
  threadDiameter: number
  threadPitch: number
  threadLength: number
  threadClearance: number
  threadDirection: ThreadDirection
  radialSegments: number
}

export interface ThreadedHubGeneration {
  mesh: MeshData
  inputFrame: ConnectionFrame
  outputFrame: ConnectionFrame
  hubOuterDiameter: number
  hubHeight: number
  wallThickness: number
  centralOpeningDiameter: number
  threadedConnection: {
    diameter: number
    pitch: number
    length: number
    clearance: number
    direction: ThreadDirection
  }
  retainingInterface: {
    outerDiameter: number
    height: number
    wallThickness: number
  }
}

function number(parameters: ThreadedHubParameters, id: keyof ThreadedHubParameters): number {
  return Number(parameters[id])
}

export function validateThreadedHub(parameters: ThreadedHubParameters): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  const hubOuterDiameter = number(parameters, 'hubOuterDiameter')
  const hubHeight = number(parameters, 'hubHeight')
  const hubWallThickness = number(parameters, 'hubWallThickness')
  const threadDiameter = number(parameters, 'threadDiameter')
  const threadPitch = number(parameters, 'threadPitch')
  const threadLength = number(parameters, 'threadLength')
  const threadClearance = number(parameters, 'threadClearance')
  const radialSegments = number(parameters, 'radialSegments')

  if (!Number.isFinite(hubOuterDiameter) || hubOuterDiameter <= 0) errors.push('Threaded Hub outer diameter must be greater than zero.')
  if (!Number.isFinite(hubHeight) || hubHeight <= 0) errors.push('Threaded Hub height must be greater than zero.')
  if (!Number.isFinite(hubWallThickness) || hubWallThickness <= 0) errors.push('Threaded Hub wall thickness must be greater than zero.')
  if (!Number.isFinite(threadDiameter) || threadDiameter <= 0) errors.push('Threaded Hub thread diameter must be greater than zero.')
  if (!Number.isFinite(threadPitch) || threadPitch <= 0) errors.push('Threaded Hub thread pitch must be greater than zero.')
  if (!Number.isFinite(threadLength) || threadLength <= 0) errors.push('Threaded Hub thread length must be greater than zero.')
  if (!Number.isFinite(threadClearance) || threadClearance < 0) errors.push('Threaded Hub thread clearance cannot be negative.')
  if (!Number.isInteger(radialSegments) || radialSegments < 16) errors.push('Threaded Hub radial segments must be an integer of at least 16.')
  if (parameters.threadDirection !== 'right' && parameters.threadDirection !== 'left') {
    errors.push('Threaded Hub thread direction must be right or left.')
  }

  const openingDiameter = threadDiameter + threadClearance * 2
  if (Number.isFinite(hubOuterDiameter) && Number.isFinite(openingDiameter)
    && hubOuterDiameter <= openingDiameter) {
    errors.push('Threaded Hub outer diameter must exceed its threaded opening diameter.')
  }
  if (Number.isFinite(hubOuterDiameter) && Number.isFinite(openingDiameter)
    && Number.isFinite(hubWallThickness)
    && hubOuterDiameter - openingDiameter < hubWallThickness * 2) {
    errors.push('Threaded Hub wall thickness is too large for the selected diameters.')
  }
  if (Number.isFinite(threadLength) && Number.isFinite(hubHeight) && threadLength > hubHeight) {
    errors.push('Threaded Hub thread length cannot exceed hub height.')
  }
  if (Number.isFinite(threadClearance) && Number.isFinite(threadPitch) && threadClearance > threadPitch / 2) {
    errors.push('Threaded Hub thread clearance is too large for the selected pitch.')
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

function generateAnnularHubMesh(outerRadius: number, innerRadius: number, bottomZ: number, topZ: number, segments: number): MeshData {
  const positions = new Float32Array(segments * 4 * 3)
  const indices: number[] = []
  const ring = (surface: number, column: number) => surface * segments + (column % segments + segments) % segments

  for (let column = 0; column < segments; column += 1) {
    const angle = (Math.PI * 2 * column) / segments
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
    indices.push(ring(1, column), ring(3, column), ring(3, next), ring(1, column), ring(1, next), ring(3, next))
  }

  const typedIndices = new Uint32Array(indices)
  const normals = new Float32Array(positions.length)
  for (let index = 0; index < typedIndices.length; index += 3) {
    addNormal(normals, positions, typedIndices[index], typedIndices[index + 1], typedIndices[index + 2])
  }
  for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
    const offset = vertex * 3
    const length = Math.hypot(normals[offset], normals[offset + 1], normals[offset + 2])
    if (!Number.isFinite(length) || length === 0) throw new Error('Generated Threaded Hub contains a degenerate normal.')
    normals[offset] /= length
    normals[offset + 1] /= length
    normals[offset + 2] /= length
  }

  const mesh = { positions, indices: typedIndices, normals }
  validateMeshData(mesh)
  return mesh
}

export function generateThreadedHub(
  parameters: ThreadedHubParameters,
  requestedFrame: ConnectionFrame,
): ThreadedHubGeneration {
  const validation = validateThreadedHub(parameters)
  if (!validation.valid) throw new Error(validation.errors.join(' '))
  validateConnectionFrame(requestedFrame, 'Threaded Hub input frame')

  const outerRadius = parameters.hubOuterDiameter / 2
  const openingRadius = parameters.threadDiameter / 2 + parameters.threadClearance
  const inputFrame = createConnectionFrame(requestedFrame.position.z, outerRadius)
  const outputFrame = createConnectionFrame(inputFrame.position.z + parameters.hubHeight, outerRadius)
  const mesh = generateAnnularHubMesh(
    outerRadius,
    openingRadius,
    inputFrame.position.z,
    outputFrame.position.z,
    parameters.radialSegments,
  )

  return {
    mesh,
    inputFrame,
    outputFrame,
    hubOuterDiameter: parameters.hubOuterDiameter,
    hubHeight: parameters.hubHeight,
    wallThickness: outerRadius - openingRadius,
    centralOpeningDiameter: openingRadius * 2,
    threadedConnection: {
      diameter: parameters.threadDiameter,
      pitch: parameters.threadPitch,
      length: parameters.threadLength,
      clearance: parameters.threadClearance,
      direction: parameters.threadDirection,
    },
    retainingInterface: {
      outerDiameter: parameters.hubOuterDiameter,
      height: parameters.hubHeight,
      wallThickness: parameters.hubWallThickness,
    },
  }
}
