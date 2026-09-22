import type { ParameterValues } from '../parametric/types'

export type GeometryBackendId = 'replicad' | 'procedural' | 'other'

export const FRAME_TOLERANCE = 1e-5

export interface Vector3 {
  x: number
  y: number
  z: number
}

export interface ConnectionFrame {
  position: Vector3
  axis: Vector3
  radius: number
}

export interface ProfileRingPoint {
  angle: number
  radius: number
}

export interface ProfileRing {
  z: number
  points: readonly ProfileRingPoint[]
}

export type Anchor = ConnectionFrame
export type InterfaceFrame = ConnectionFrame

export interface MeshPart {
  id: string
  mesh: MeshData
  inputFrame?: ConnectionFrame
  outputFrame?: ConnectionFrame
}

export interface ConnectionMarker {
  id: string
  frame: ConnectionFrame
}

export interface ProfileRingMarker {
  id: string
  ring: ProfileRing
}

export interface MeshData {
  positions: Float32Array
  indices: Uint32Array
  normals?: Float32Array
  /** Viewport-only metadata; export uses only positions, indices, and normals. */
  parts?: readonly MeshPart[]
  /** Viewport-only connection markers; never included in exportable geometry. */
  connectionFrames?: readonly ConnectionMarker[]
  /** Viewport-only profile-loop markers; never included in exportable geometry. */
  profileRings?: readonly ProfileRingMarker[]
}

export function createConnectionFrame(z: number, radius: number): ConnectionFrame {
  return {
    position: { x: 0, y: 0, z },
    axis: { x: 0, y: 0, z: 1 },
    radius,
  }
}

export interface GeometryRequest {
  backend: GeometryBackendId
  operation: string
  parameters: ParameterValues
}

export interface GeometryBackend {
  id: GeometryBackendId
  generate(request: GeometryRequest): Promise<MeshData>
}

export function validateMeshData(mesh: MeshData): void {
  if (mesh.positions.length === 0 || mesh.positions.length % 3 !== 0) {
    throw new Error('Generated mesh positions must contain complete vertices.')
  }
  if (mesh.indices.length === 0 || mesh.indices.length % 3 !== 0) {
    throw new Error('Generated mesh indices must contain complete triangles.')
  }
  if (mesh.normals && mesh.normals.length !== mesh.positions.length) {
    throw new Error('Generated mesh normals must match the position count.')
  }

  for (const value of mesh.positions) {
    if (!Number.isFinite(value)) throw new Error('Generated mesh positions contain a non-finite value.')
  }
  if (mesh.normals) {
    for (const value of mesh.normals) {
      if (!Number.isFinite(value)) throw new Error('Generated mesh normals contain a non-finite value.')
    }
  }

  const vertexCount = mesh.positions.length / 3
  for (const index of mesh.indices) {
    if (!Number.isInteger(index) || index < 0 || index >= vertexCount) {
      throw new Error('Generated mesh contains an invalid index.')
    }
  }
}
