import type { ParameterValues } from '../parametric/types'

export type GeometryBackendId = 'replicad' | 'procedural' | 'other'

export interface MeshData {
  positions: Float32Array
  indices: Uint32Array
  normals?: Float32Array
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
