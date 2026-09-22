import opencascade from 'replicad-opencascadejs'
import wasmUrl from 'replicad-opencascadejs/wasm?url'
import { setOC } from 'replicad'
import { proceduralBackend } from '../cad/procedural-backend'
import { replicadBackend } from '../cad/replicad-backend'
import { validateMeshData } from '../geometry/types'
import type { CadWorkerRequest, CadWorkerResponse } from './cad.protocol'

interface WorkerScope {
  onmessage: ((event: MessageEvent<CadWorkerRequest>) => void) | null
  postMessage(message: CadWorkerResponse, transfer?: Transferable[]): void
}

// SAFETY: Vite executes this module as a dedicated worker, whose global API matches WorkerScope.
const workerScope = self as unknown as WorkerScope
let openCascadeReady: Promise<void> | undefined

function ensureOpenCascade(): Promise<void> {
  openCascadeReady ??= opencascade({ locateFile: () => wasmUrl }).then((oc) => {
    setOC(oc)
  })
  return openCascadeReady
}

workerScope.onmessage = async (event: MessageEvent<CadWorkerRequest>) => {
  const { requestId, request } = event.data

  try {
    const backend = request.backend === 'procedural' ? proceduralBackend : replicadBackend
    if (backend.id === 'replicad') await ensureOpenCascade()
    const mesh = await backend.generate(request)
    validateMeshData(mesh)
    const response: CadWorkerResponse = { type: 'generated', requestId, mesh }
    const transferables: Transferable[] = [mesh.positions.buffer, mesh.indices.buffer]
    if (mesh.normals) transferables.push(mesh.normals.buffer)
    workerScope.postMessage(response, transferables)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'CAD generation failed.'
    workerScope.postMessage({ type: 'error', requestId, message } satisfies CadWorkerResponse)
  }
}

export {}
