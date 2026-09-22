import type { GeometryRequest, MeshData } from '../geometry/types'
import type { CadWorkerResponse } from '../workers/cad.protocol'

interface PendingRequest {
  resolve: (mesh: MeshData) => void
  reject: (error: Error) => void
}

export class CadClient {
  private readonly worker: Worker
  private nextRequestId = 1
  private readonly pending = new Map<number, PendingRequest>()

  constructor() {
    this.worker = new Worker(new URL('../workers/cad.worker.ts', import.meta.url), { type: 'module' })
    this.worker.onmessage = (event: MessageEvent<CadWorkerResponse>) => {
      const response = event.data
      const request = this.pending.get(response.requestId)
      if (!request) return
      this.pending.delete(response.requestId)

      if (response.type === 'generated') {
        request.resolve(response.mesh)
      } else {
        request.reject(new Error(response.message))
      }
    }
    this.worker.onerror = () => {
      this.rejectAll(new Error('The CAD worker stopped unexpectedly.'))
    }
  }

  generate(request: GeometryRequest): Promise<MeshData> {
    const requestId = this.nextRequestId++
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject })
      this.worker.postMessage({ type: 'generate', requestId, request })
    })
  }

  dispose(): void {
    this.rejectAll(new Error('The CAD worker was disposed.'))
    this.worker.terminate()
  }

  private rejectAll(error: Error): void {
    for (const request of this.pending.values()) request.reject(error)
    this.pending.clear()
  }
}

let client: CadClient | undefined

export function getCadClient(): CadClient {
  client ??= new CadClient()
  return client
}
