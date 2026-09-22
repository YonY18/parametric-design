import type { GeometryRequest, MeshData } from '../geometry/types'

export interface GenerateMessage {
  type: 'generate'
  requestId: number
  request: GeometryRequest
}

export interface GeneratedMessage {
  type: 'generated'
  requestId: number
  mesh: MeshData
}

export interface GenerationErrorMessage {
  type: 'error'
  requestId: number
  message: string
}

export type CadWorkerRequest = GenerateMessage
export type CadWorkerResponse = GeneratedMessage | GenerationErrorMessage
