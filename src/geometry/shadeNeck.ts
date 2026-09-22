import type {
  NumberParameterDefinition,
  ParameterDefinition,
  ParameterValues,
  ValidationResult,
} from '../parametric/types'
import { validateConnectionFrame } from './assembly'
import { createConnectionFrame, validateMeshData, type ConnectionFrame, type MeshData } from './types'

export interface ShadeNeckParameters extends ParameterValues {
  neckOuterDiameter: number
  neckInnerDiameter: number
  neckHeight: number
  flangeOuterDiameter: number
  flangeInnerDiameter: number
  flangeThickness: number
  flangePosition: number
  seatClearance: number
}

export interface ShadeNeckGeneration {
  mesh: MeshData
  inputFrame: ConnectionFrame
  flangeFrame: ConnectionFrame
  pressureFaceFrame: ConnectionFrame
  neckTopFrame: ConnectionFrame
  outputFrame: ConnectionFrame
}

export interface ShadeNeckDefinition {
  id: string
  name: string
  category: string
  parameters: readonly ParameterDefinition[]
  validate(parameters: ShadeNeckParameters): ValidationResult
  generate(parameters: ShadeNeckParameters, supportFrame?: ConnectionFrame): ShadeNeckGeneration
}

const numberParameter = (
  id: string,
  label: string,
  description: string,
  min: number,
  max: number,
  step: number,
): NumberParameterDefinition => ({ id, label, description, type: 'number', unit: 'mm', min, max, step })

const shadeNeckParameters: readonly ParameterDefinition[] = [
  numberParameter('neckOuterDiameter', 'Neck outer diameter', 'Outside diameter of the straight mechanical neck.', 0.1, 300, 0.5),
  numberParameter('neckInnerDiameter', 'Neck inner diameter', 'Cable and optical opening through the neck.', 0.1, 300, 0.5),
  numberParameter('neckHeight', 'Neck height', 'Height before decorative shade deformation begins.', 0.1, 100, 0.5),
  numberParameter('flangeOuterDiameter', 'Flange outer diameter', 'Outside diameter of the flange seated on the support lip.', 0.1, 300, 0.5),
  numberParameter('flangeInnerDiameter', 'Flange inner diameter', 'Opening through the retaining flange.', 0.1, 300, 0.5),
  numberParameter('flangeThickness', 'Flange thickness', 'Axial thickness trapped by the retaining ring.', 0.01, 50, 0.1),
  numberParameter('flangePosition', 'Flange position', 'Axial offset from the support frame; zero seats directly on the lip.', 0, 100, 0.5),
  numberParameter('seatClearance', 'Seat clearance', 'Radial clearance between the flange opening and support lip.', 0, 10, 0.05),
]

export function validateShadeNeck(parameters: ShadeNeckParameters): ValidationResult {
  const errors: string[] = []
  const neckOuterDiameter = Number(parameters.neckOuterDiameter)
  const neckInnerDiameter = Number(parameters.neckInnerDiameter)
  const neckHeight = Number(parameters.neckHeight)
  const flangeOuterDiameter = Number(parameters.flangeOuterDiameter)
  const flangeInnerDiameter = Number(parameters.flangeInnerDiameter)
  const flangeThickness = Number(parameters.flangeThickness)
  const flangePosition = Number(parameters.flangePosition)
  const seatClearance = Number(parameters.seatClearance)
  if (!Number.isFinite(neckOuterDiameter) || neckOuterDiameter <= 0) errors.push('Shade neck outer diameter must be greater than zero.')
  if (!Number.isFinite(neckInnerDiameter) || neckInnerDiameter <= 0) errors.push('Shade neck inner diameter must be greater than zero.')
  if (!Number.isFinite(neckHeight) || neckHeight <= 0) errors.push('Shade neck height must be greater than zero.')
  if (!Number.isFinite(flangeOuterDiameter) || flangeOuterDiameter <= 0) errors.push('Shade flange outer diameter must be greater than zero.')
  if (!Number.isFinite(flangeInnerDiameter) || flangeInnerDiameter <= 0) errors.push('Shade flange inner diameter must be greater than zero.')
  if (!Number.isFinite(flangeThickness) || flangeThickness <= 0) errors.push('Shade flange thickness must be greater than zero.')
  if (!Number.isFinite(flangePosition) || flangePosition < 0) errors.push('Shade flange position cannot be negative.')
  if (!Number.isFinite(seatClearance) || seatClearance < 0) errors.push('Seat clearance cannot be negative.')
  if (Number.isFinite(neckOuterDiameter) && Number.isFinite(neckInnerDiameter)
    && neckOuterDiameter <= neckInnerDiameter) errors.push('Shade neck outer diameter must be greater than inner diameter.')
  if (Number.isFinite(flangeOuterDiameter) && Number.isFinite(flangeInnerDiameter)
    && flangeOuterDiameter <= flangeInnerDiameter) errors.push('Shade flange outer diameter must be greater than inner diameter.')
  if (Number.isFinite(flangeOuterDiameter) && Number.isFinite(neckOuterDiameter)
    && flangeOuterDiameter < neckOuterDiameter) errors.push('Shade flange must extend beyond the neck outer diameter.')
  if (Number.isFinite(flangeInnerDiameter) && Number.isFinite(neckInnerDiameter)
    && flangeInnerDiameter < neckInnerDiameter) errors.push('Shade flange opening cannot be smaller than the neck opening.')
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

function createAnnularMesh(outerRadius: number, innerRadius: number, bottomZ: number, topZ: number): MeshData {
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
  for (let index = 0; index < typedIndices.length; index += 3) addNormal(normals, positions, typedIndices[index], typedIndices[index + 1], typedIndices[index + 2])
  for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
    const offset = vertex * 3
    const length = Math.hypot(normals[offset], normals[offset + 1], normals[offset + 2])
    if (!Number.isFinite(length) || length === 0) throw new Error('Generated shade neck contains a degenerate normal.')
    normals[offset] /= length
    normals[offset + 1] /= length
    normals[offset + 2] /= length
  }
  const mesh = { positions, indices: typedIndices, normals }
  validateMeshData(mesh)
  return mesh
}

function requiredNormals(mesh: MeshData): Float32Array {
  if (!mesh.normals) throw new Error('Generated shade neck mesh is missing normals.')
  return mesh.normals
}

function mergeMeshes(first: MeshData, second: MeshData): MeshData {
  const positions = new Float32Array(first.positions.length + second.positions.length)
  positions.set(first.positions)
  positions.set(second.positions, first.positions.length)
  const indices = new Uint32Array(first.indices.length + second.indices.length)
  indices.set(first.indices)
  const vertexOffset = first.positions.length / 3
  for (let index = 0; index < second.indices.length; index += 1) indices[first.indices.length + index] = second.indices[index] + vertexOffset
  const firstNormals = requiredNormals(first)
  const secondNormals = requiredNormals(second)
  const normals = new Float32Array(firstNormals.length + secondNormals.length)
  normals.set(firstNormals)
  normals.set(secondNormals, firstNormals.length)
  const mesh = { positions, indices, normals }
  validateMeshData(mesh)
  return mesh
}

export const shadeNeckDefinition: ShadeNeckDefinition = {
  id: 'shade-neck',
  name: 'Shade Neck and Flange',
  category: 'Mechanical Interface',
  parameters: shadeNeckParameters,
  validate: validateShadeNeck,
  generate(parameters, requestedSupportFrame) {
    const validation = validateShadeNeck(parameters)
    if (!validation.valid) throw new Error(validation.errors.join(' '))
    const supportFrame = requestedSupportFrame ?? createConnectionFrame(0, parameters.flangeOuterDiameter / 2)
    validateConnectionFrame(supportFrame, 'Shade neck support frame')
    const flangeZ = supportFrame.position.z + parameters.flangePosition
    const flangeFrame = createConnectionFrame(flangeZ, parameters.flangeOuterDiameter / 2)
    const pressureFaceFrame = createConnectionFrame(flangeZ + parameters.flangeThickness, parameters.flangeOuterDiameter / 2)
    const neckTopFrame = createConnectionFrame(
      pressureFaceFrame.position.z + parameters.neckHeight,
      parameters.neckOuterDiameter / 2,
    )
    const flange = createAnnularMesh(
      parameters.flangeOuterDiameter / 2,
      parameters.flangeInnerDiameter / 2,
      flangeZ,
      flangeZ + parameters.flangeThickness,
    )
    const neck = createAnnularMesh(
      parameters.neckOuterDiameter / 2,
      parameters.neckInnerDiameter / 2,
      pressureFaceFrame.position.z,
      neckTopFrame.position.z,
    )
    return {
      mesh: mergeMeshes(flange, neck),
      inputFrame: supportFrame,
      flangeFrame,
      pressureFaceFrame,
      neckTopFrame,
      outputFrame: pressureFaceFrame,
    }
  },
}

export const shadeNeck = shadeNeckDefinition
