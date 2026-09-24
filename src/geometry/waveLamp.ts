import { validateConnectionFrame } from './assembly'
import {
  createDecorativeProfilePoint,
  type DecorativeProfileParameters,
} from './decorativeProfile'
import { createConnectionFrame, validateMeshData, type ConnectionFrame, type MeshData, type ProfileRing } from './types'
import type { ParameterValues } from '../parametric/types'

function parameterNumber(parameters: ParameterValues, id: string, legacyId?: string): number {
  const value = Number(parameters[id] ?? (legacyId ? parameters[legacyId] : undefined))
  if (!Number.isFinite(value)) throw new Error(`Parameter "${id}" must be a finite number.`)
  return value
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

function decorativeParameters(parameters: ParameterValues): DecorativeProfileParameters {
  return parameters as DecorativeProfileParameters
}

function createShadePoint(
  parameters: ParameterValues,
  inputFrame: ConnectionFrame,
  normalizedHeight: number,
  angle: number,
  deformationWeight = 1,
) {
  const mountingEnd = normalizedHeight === 0
  return createDecorativeProfilePoint(
    decorativeParameters(parameters),
    normalizedHeight,
    angle,
    mountingEnd ? 0 : deformationWeight,
    mountingEnd ? inputFrame.radius : undefined,
    mountingEnd ? 0 : 1,
  )
}

export function createWaveLampProfileRing(options: WaveLampProfileOptions): ProfileRing {
  const height = parameterNumber(options.parameters, 'height')
  const radialSegments = parameterNumber(options.parameters, 'radialSegments')
  const t = Math.min(1, Math.max(0, options.normalizedHeight))
  validateConnectionFrame(options.inputFrame, 'Shade input frame')
  const points = []
  for (let column = 0; column < radialSegments; column += 1) {
    const angle = (Math.PI * 2 * column) / radialSegments
    const point = createShadePoint(options.parameters, options.inputFrame, t, angle, options.deformationWeight)
    points.push({ angle: point.angle, radius: point.radius })
  }
  return { z: options.inputFrame.position.z + height * t, points }
}

function addTriangle(indices: number[], a: number, b: number, c: number): void {
  indices.push(a, b, c)
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
  const maxRadius = parameterNumber(parameters, 'bottomDiameter', 'maxDiameter') / 2
  const wallThickness = parameterNumber(parameters, 'wallThickness')
  const verticalSegments = parameterNumber(parameters, 'verticalSegments')
  const radialSegments = parameterNumber(parameters, 'radialSegments')

  const rows = verticalSegments + 1
  const ringVertexCount = rows * radialSegments
  const vertexCount = ringVertexCount * 2
  const positions = new Float32Array(vertexCount * 3)
  const indices: number[] = []
  const shadeInputFrame = lampComposition?.shadeInputFrame ?? createConnectionFrame(0, maxRadius)
  validateConnectionFrame(shadeInputFrame, 'Shade input frame')
  const shadeStartZ = shadeInputFrame.position.z
  const rowIndex = (row: number, column: number) => row * radialSegments + (column % radialSegments + radialSegments) % radialSegments
  const outerIndex = (row: number, column: number) => rowIndex(row, column)
  const innerIndex = (row: number, column: number) => ringVertexCount + rowIndex(row, column)

  for (let row = 0; row < rows; row += 1) {
    const t = row / verticalSegments
    const z = shadeStartZ + height * t
    for (let column = 0; column < radialSegments; column += 1) {
      const angle = (Math.PI * 2 * column) / radialSegments
      const point = createShadePoint(parameters, shadeInputFrame, t, angle)
      const radius = point.radius
      if (radius <= wallThickness || point.innerRadius <= 0) throw new Error('Wave amplitude too large for current wall thickness.')
      const cosAngle = Math.cos(point.angle)
      const sinAngle = Math.sin(point.angle)
      const outer = outerIndex(row, column)
      const inner = innerIndex(row, column)
      const innerRadius = point.innerRadius

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
  for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex += 1) {
    const offset = vertexIndex * 3
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
