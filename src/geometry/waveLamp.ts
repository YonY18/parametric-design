import {
  applyDeformers,
  createWaveLampDeformers,
  type DeformerVertex,
} from './deformers'
import { validateConnectionFrame } from './assembly'
import { createConnectionFrame, validateMeshData, type ConnectionFrame, type MeshData, type ProfileRing } from './types'
import type { ParameterValues } from '../parametric/types'

function parameterNumber(parameters: ParameterValues, id: string): number {
  const value = Number(parameters[id])
  if (!Number.isFinite(value)) throw new Error(`Parameter "${id}" must be a finite number.`)
  return value
}

function parameterBoolean(parameters: ParameterValues, id: string): boolean {
  const value = parameters[id]
  if (value === undefined) return true
  if (typeof value !== 'boolean') throw new Error(`Parameter "${id}" must be a boolean.`)
  return value
}

function addTriangle(indices: number[], a: number, b: number, c: number): void {
  indices.push(a, b, c)
}

export interface WaveLampComposition {
  shadeInputFrame?: ConnectionFrame
}

export interface WaveLampProfileOptions {
  parameters: ParameterValues
  inputFrame: ConnectionFrame
  normalizedHeight: number
  deformationWeight?: number
}

function waveLampDeformers(parameters: ParameterValues) {
  return createWaveLampDeformers({
    waves: parameterNumber(parameters, 'waves'),
    waveAmplitude: parameterNumber(parameters, 'waveAmplitude'),
    wavePhase: parameterNumber(parameters, 'wavePhase'),
    twist: parameterNumber(parameters, 'twist'),
    bulgeAmount: parameterNumber(parameters, 'bulgeAmount'),
    bulgeCenter: parameterNumber(parameters, 'bulgeCenter'),
    bulgeWidth: parameterNumber(parameters, 'bulgeWidth'),
    verticalWaveCount: parameterNumber(parameters, 'verticalWaveCount'),
    verticalWaveAmplitude: parameterNumber(parameters, 'verticalWaveAmplitude'),
    verticalWavePhase: parameterNumber(parameters, 'verticalWavePhase'),
    taperBottomScale: parameterNumber(parameters, 'taperBottomScale'),
    taperTopScale: parameterNumber(parameters, 'taperTopScale'),
    taperEnabled: parameterBoolean(parameters, 'taperEnabled'),
    waveEnabled: parameterBoolean(parameters, 'waveEnabled'),
    twistEnabled: parameterBoolean(parameters, 'twistEnabled'),
    bulgeEnabled: parameterBoolean(parameters, 'bulgeEnabled'),
    verticalWaveEnabled: parameterBoolean(parameters, 'verticalWaveEnabled'),
  })
}

export function createWaveLampProfileRing(options: WaveLampProfileOptions): ProfileRing {
  const height = parameterNumber(options.parameters, 'height')
  const topRadius = parameterNumber(options.parameters, 'topDiameter') / 2
  const radialSegments = parameterNumber(options.parameters, 'radialSegments')
  const t = Math.min(1, Math.max(0, options.normalizedHeight))
  const deformers = waveLampDeformers(options.parameters)
  const vertex: DeformerVertex = {
    normalizedHeight: t,
    angle: 0,
    radius: options.inputFrame.radius,
    deformationWeight: options.deformationWeight ?? 1,
  }
  const points = []
  for (let column = 0; column < radialSegments; column += 1) {
    vertex.normalizedHeight = t
    vertex.angle = (Math.PI * 2 * column) / radialSegments
    vertex.radius = options.inputFrame.radius + (topRadius - options.inputFrame.radius) * t
    vertex.deformationWeight = options.deformationWeight ?? 1
    applyDeformers(vertex, deformers)
    points.push({ angle: vertex.angle, radius: vertex.radius })
  }
  return { z: options.inputFrame.position.z + height * t, points }
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

  normals[a * 3] += nx
  normals[a * 3 + 1] += ny
  normals[a * 3 + 2] += nz
  normals[b * 3] += nx
  normals[b * 3 + 1] += ny
  normals[b * 3 + 2] += nz
  normals[c * 3] += nx
  normals[c * 3 + 1] += ny
  normals[c * 3 + 2] += nz
}

export function generateWaveLampMesh(
  parameters: ParameterValues,
  lampComposition?: WaveLampComposition,
): MeshData {
  const height = parameterNumber(parameters, 'height')
  const bottomDiameter = parameterNumber(parameters, 'bottomDiameter')
  const topDiameter = parameterNumber(parameters, 'topDiameter')
  const wallThickness = parameterNumber(parameters, 'wallThickness')
  const verticalSegments = parameterNumber(parameters, 'verticalSegments')
  const radialSegments = parameterNumber(parameters, 'radialSegments')

  const rows = verticalSegments + 1
  const ringVertexCount = rows * radialSegments
  const vertexCount = ringVertexCount * 2
  const positions = new Float32Array(vertexCount * 3)
  const indices: number[] = []
  const bottomRadius = bottomDiameter / 2
  const topRadius = topDiameter / 2
  const shadeInputFrame = lampComposition?.shadeInputFrame ?? createConnectionFrame(0, bottomRadius)
  validateConnectionFrame(shadeInputFrame, 'Shade input frame')
  const shadeBottomRadius = shadeInputFrame.radius
  const shadeStartZ = shadeInputFrame.position.z
  const deformers = waveLampDeformers(parameters)
  const rowIndex = (row: number, column: number) => row * radialSegments + (column % radialSegments + radialSegments) % radialSegments
  const outerIndex = (row: number, column: number) => rowIndex(row, column)
  const innerIndex = (row: number, column: number) => ringVertexCount + rowIndex(row, column)
  const vertex: DeformerVertex = { normalizedHeight: 0, angle: 0, radius: shadeBottomRadius, deformationWeight: 1 }

  for (let row = 0; row < rows; row += 1) {
    const t = row / verticalSegments
    const z = shadeStartZ + height * t
    for (let column = 0; column < radialSegments; column += 1) {
      vertex.normalizedHeight = t
      vertex.angle = (Math.PI * 2 * column) / radialSegments
      vertex.radius = shadeBottomRadius + (topRadius - shadeBottomRadius) * t
      const lastDeformerName = applyDeformers(vertex, deformers)

      const radius = vertex.radius
      if (radius <= wallThickness) {
        throw new Error(`Deformer "${lastDeformerName}" collapsed the inner surface; reduce a radial amplitude.`)
      }
      const cosAngle = Math.cos(vertex.angle)
      const sinAngle = Math.sin(vertex.angle)
      const outer = outerIndex(row, column)
      const inner = innerIndex(row, column)
      const innerRadius = radius - wallThickness

      positions[outer * 3] = cosAngle * radius
      positions[outer * 3 + 1] = sinAngle * radius
      positions[outer * 3 + 2] = z
      positions[inner * 3] = cosAngle * innerRadius
      positions[inner * 3 + 1] = sinAngle * innerRadius
      positions[inner * 3 + 2] = z
    }
  }

  for (let row = 0; row < verticalSegments; row += 1) {
    for (let column = 0; column < radialSegments; column += 1) {
      const nextColumn = column + 1
      const outer = outerIndex(row, column)
      const outerNext = outerIndex(row, nextColumn)
      const outerUp = outerIndex(row + 1, column)
      const outerUpNext = outerIndex(row + 1, nextColumn)
      const inner = innerIndex(row, column)
      const innerNext = innerIndex(row, nextColumn)
      const innerUp = innerIndex(row + 1, column)
      const innerUpNext = innerIndex(row + 1, nextColumn)

      addTriangle(indices, outer, outerNext, outerUpNext)
      addTriangle(indices, outer, outerUpNext, outerUp)
      addTriangle(indices, inner, innerUp, innerUpNext)
      addTriangle(indices, inner, innerUpNext, innerNext)
    }
  }

  for (let column = 0; column < radialSegments; column += 1) {
    const nextColumn = column + 1
    addTriangle(indices, outerIndex(verticalSegments, column), outerIndex(verticalSegments, nextColumn), innerIndex(verticalSegments, column))
    addTriangle(indices, outerIndex(verticalSegments, nextColumn), innerIndex(verticalSegments, nextColumn), innerIndex(verticalSegments, column))
    addTriangle(indices, outerIndex(0, column), innerIndex(0, column), outerIndex(0, nextColumn))
    addTriangle(indices, outerIndex(0, nextColumn), innerIndex(0, column), innerIndex(0, nextColumn))
  }

  const typedIndices = new Uint32Array(indices)
  const normals = new Float32Array(positions.length)
  for (let index = 0; index < typedIndices.length; index += 3) {
    addNormal(normals, positions, typedIndices[index], typedIndices[index + 1], typedIndices[index + 2])
  }
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const offset = vertex * 3
    const length = Math.hypot(normals[offset], normals[offset + 1], normals[offset + 2])
    if (!Number.isFinite(length) || length === 0) throw new Error('Generated Wave Lamp contains a degenerate normal.')
    normals[offset] /= length
    normals[offset + 1] /= length
    normals[offset + 2] /= length
  }

  const shadeMesh = { positions, indices: typedIndices, normals }
  validateMeshData(shadeMesh)
  return shadeMesh
}
