import { validateMeshData, type MeshData } from './types'

export interface RevolvedProfilePoint {
  radius: number
  z: number
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

/** Revolve a closed radial profile around Z, supporting solid caps at radius zero. */
export function generateRevolvedProfileMesh(
  profile: readonly RevolvedProfilePoint[],
  segments: number,
  label = 'Revolved mesh',
): MeshData {
  if (profile.length < 3) throw new Error(`${label} requires at least three profile points.`)
  if (!Number.isInteger(segments) || segments < 3) throw new Error(`${label} requires at least three radial segments.`)

  for (const point of profile) {
    if (!Number.isFinite(point.radius) || point.radius < 0 || !Number.isFinite(point.z)) {
      throw new Error(`${label} profile must contain finite, non-negative radii.`)
    }
  }

  const positions: number[] = []
  const vertices: number[][] = []
  for (const point of profile) {
    if (point.radius <= 1e-6) {
      vertices.push([positions.length / 3])
      positions.push(0, 0, point.z)
      continue
    }
    const ring: number[] = []
    for (let column = 0; column < segments; column += 1) {
      const angle = (Math.PI * 2 * column) / segments
      ring.push(positions.length / 3)
      positions.push(Math.cos(angle) * point.radius, Math.sin(angle) * point.radius, point.z)
    }
    vertices.push(ring)
  }

  const indices: number[] = []
  const addTriangle = (a: number, b: number, c: number) => {
    if (a !== b && b !== c && c !== a) indices.push(a, b, c)
  }
  for (let pointIndex = 0; pointIndex < profile.length; pointIndex += 1) {
    const nextPointIndex = (pointIndex + 1) % profile.length
    const from = vertices[pointIndex]
    const to = vertices[nextPointIndex]
    if (from.length === 1 && to.length === 1) continue
    for (let column = 0; column < segments; column += 1) {
      const nextColumn = (column + 1) % segments
      if (from.length === 1) {
        addTriangle(from[0], to[nextColumn], to[column])
      } else if (to.length === 1) {
        addTriangle(from[column], to[0], from[nextColumn])
      } else {
        addTriangle(from[column], to[column], to[nextColumn])
        addTriangle(from[column], to[nextColumn], from[nextColumn])
      }
    }
  }

  const typedPositions = new Float32Array(positions)
  const typedIndices = new Uint32Array(indices)
  const normalValues = new Array<number>(positions.length).fill(0)
  for (let index = 0; index < typedIndices.length; index += 3) {
    addNormal(normalValues, positions, typedIndices[index], typedIndices[index + 1], typedIndices[index + 2])
  }
  const normals = new Float32Array(positions.length)
  for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
    const offset = vertex * 3
    const length = Math.hypot(normalValues[offset], normalValues[offset + 1], normalValues[offset + 2])
    if (!Number.isFinite(length) || length === 0) throw new Error(`${label} contains a degenerate normal.`)
    normals[offset] = normalValues[offset] / length
    normals[offset + 1] = normalValues[offset + 1] / length
    normals[offset + 2] = normalValues[offset + 2] / length
  }

  const mesh = { positions: typedPositions, indices: typedIndices, normals }
  validateMeshData(mesh)
  return mesh
}
