import { validateConnectionFrame } from './assembly'
import { generateThreadFeature, type ThreadDirection } from './threadFeature'
import { threadSpecFromLegacy, validateThreadSpec, type ThreadProfileType, type ThreadSpec } from './threadSpec'
import { createConnectionFrame, validateMeshData, type ConnectionFrame, type MeshData } from './types'

export interface ThreadedHubParameters {
  [key: string]: unknown
  hubOuterDiameter: number
  hubHeight: number
  hubWallThickness: number
  hubOpeningDiameter?: number
  threadSpec?: ThreadSpec
  threadDiameter?: number
  threadPitch?: number
  threadLength?: number
  threadClearance?: number
  threadDirection?: ThreadDirection
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
    depth: number
    clearance: number
    direction: ThreadDirection
    profileType: ThreadProfileType
  }
  retainingInterface: {
    outerDiameter: number
    height: number
    wallThickness: number
  }
}

function resolveSpec(parameters: ThreadedHubParameters): ThreadSpec {
  return parameters.threadSpec ?? threadSpecFromLegacy({
    nominalDiameter: Number(parameters.threadDiameter),
    pitch: Number(parameters.threadPitch),
    length: Number(parameters.threadLength),
    clearance: Number(parameters.threadClearance),
    handedness: parameters.threadDirection,
  })
}

function number(parameters: ThreadedHubParameters, id: string): number {
  return Number(parameters[id])
}

export function validateThreadedHub(parameters: ThreadedHubParameters): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  let spec: ThreadSpec
  try {
    spec = resolveSpec(parameters)
  } catch (error) {
    return { valid: false, errors: [error instanceof Error ? error.message : 'Threaded Hub thread specification is invalid.'] }
  }
  errors.push(...validateThreadSpec(spec).errors)
  const hubOuterDiameter = number(parameters, 'hubOuterDiameter')
  const hubHeight = number(parameters, 'hubHeight')
  const hubWallThickness = number(parameters, 'hubWallThickness')
  const openingDiameter = Number(parameters.hubOpeningDiameter ?? Math.max(0.1, spec.nominalDiameter - hubWallThickness * 2))
  const radialSegments = number(parameters, 'radialSegments')

  if (!Number.isFinite(hubOuterDiameter) || hubOuterDiameter <= 0) errors.push('Threaded Hub outer diameter must be greater than zero.')
  if (!Number.isFinite(hubHeight) || hubHeight <= 0) errors.push('Threaded Hub height must be greater than zero.')
  if (!Number.isFinite(hubWallThickness) || hubWallThickness <= 0) errors.push('Threaded Hub wall thickness must be greater than zero.')
  if (!Number.isFinite(openingDiameter) || openingDiameter <= 0) errors.push('Threaded Hub opening diameter must be greater than zero.')
  if (Number.isFinite(hubOuterDiameter) && hubOuterDiameter < spec.nominalDiameter) {
    errors.push('Threaded Hub outer diameter must contain the nominal thread diameter.')
  }
  if (Number.isFinite(hubOuterDiameter) && Number.isFinite(openingDiameter) && hubOuterDiameter <= openingDiameter) {
    errors.push('Threaded Hub outer diameter must exceed its opening diameter.')
  }
  if (Number.isFinite(hubOuterDiameter) && Number.isFinite(openingDiameter)
    && Number.isFinite(hubWallThickness) && hubOuterDiameter - openingDiameter < hubWallThickness * 2) {
    errors.push('Threaded Hub wall thickness is too large for the selected diameters.')
  }
  if (!Number.isInteger(radialSegments) || radialSegments < 16) errors.push('Threaded Hub radial segments must be an integer of at least 16.')
  if (Number.isFinite(spec.length) && Number.isFinite(hubHeight) && spec.length > hubHeight) {
    errors.push('Threaded Hub thread length cannot exceed hub height.')
  }
  return { valid: errors.length === 0, errors }
}

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

function generateHubMesh(
  outerRadius: number,
  innerRadius: number,
  bottomZ: number,
  topZ: number,
  segments: number,
  thread: ReturnType<typeof generateThreadFeature>,
  pitch: number,
): MeshData {
  const positions: number[] = []
  const indices: number[] = []
  const ring = (surface: number, column: number) => surface * segments + (column % segments + segments) % segments
  const pushVertex = (radius: number, angle: number, z: number) => {
    positions.push(Math.cos(angle) * radius, Math.sin(angle) * radius, z)
  }

  for (let surface = 0; surface < 4; surface += 1) {
    for (let column = 0; column < segments; column += 1) {
      const angle = (Math.PI * 2 * column) / segments
      const radius = surface < 2 ? outerRadius : innerRadius
      const z = surface % 2 === 0 ? bottomZ : topZ
      pushVertex(radius, angle, z)
    }
  }
  for (let column = 0; column < segments; column += 1) {
    const next = column + 1
    indices.push(ring(0, column), ring(0, next), ring(1, next), ring(0, column), ring(1, next), ring(1, column))
    indices.push(ring(2, column), ring(3, next), ring(2, next), ring(2, column), ring(3, column), ring(3, next))
    indices.push(ring(0, column), ring(2, next), ring(2, column), ring(0, column), ring(0, next), ring(2, next))
    indices.push(ring(1, column), ring(3, column), ring(3, next), ring(1, column), ring(1, next), ring(3, next))
  }

  const threadStart = positions.length / 3
  const rows = Math.max(8, Math.ceil(thread.length / pitch * 12) + 1)
  for (let row = 0; row < rows; row += 1) {
    const distance = thread.length * row / (rows - 1)
    const z = bottomZ + distance
    for (let column = 0; column < segments; column += 1) {
      const angle = (Math.PI * 2 * column) / segments
      pushVertex(thread.radiusAt(distance, angle), angle, z)
    }
  }
  const threadIndex = (row: number, column: number) => threadStart + row * segments + (column % segments + segments) % segments
  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < segments; column += 1) {
      const next = column + 1
      indices.push(threadIndex(row, column), threadIndex(row, next), threadIndex(row + 1, next))
      indices.push(threadIndex(row, column), threadIndex(row + 1, next), threadIndex(row + 1, column))
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
    if (!Number.isFinite(length) || length === 0) throw new Error('Generated Threaded Hub contains a degenerate normal.')
    normals[offset] = normalValues[offset] / length
    normals[offset + 1] = normalValues[offset + 1] / length
    normals[offset + 2] = normalValues[offset + 2] / length
  }
  const mesh = { positions: typedPositions, indices: typedIndices, normals }
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
  const spec = resolveSpec(parameters)
  const thread = generateThreadFeature({ threadSpec: spec, internal: false })
  const outerRadius = parameters.hubOuterDiameter / 2
  const openingRadius = Number(parameters.hubOpeningDiameter ?? Math.max(0.1, spec.nominalDiameter - parameters.hubWallThickness * 2)) / 2
  const inputFrame = createConnectionFrame(requestedFrame.position.z, outerRadius)
  const outputFrame = createConnectionFrame(inputFrame.position.z + parameters.hubHeight, outerRadius)
  const mesh = generateHubMesh(
    thread.minorRadius,
    openingRadius,
    inputFrame.position.z,
    outputFrame.position.z,
    parameters.radialSegments,
    thread,
    spec.pitch,
  )

  return {
    mesh,
    inputFrame,
    outputFrame,
    hubOuterDiameter: parameters.hubOuterDiameter,
    hubHeight: parameters.hubHeight,
    wallThickness: thread.minorRadius - openingRadius,
    centralOpeningDiameter: openingRadius * 2,
    threadedConnection: {
      diameter: spec.nominalDiameter,
      pitch: spec.pitch,
      length: spec.length,
      depth: spec.depth,
      clearance: spec.clearance,
      direction: spec.handedness,
      profileType: spec.profileType,
    },
    retainingInterface: {
      outerDiameter: parameters.hubOuterDiameter,
      height: parameters.hubHeight,
      wallThickness: parameters.hubWallThickness,
    },
  }
}
