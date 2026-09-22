import { makeCylinder } from 'replicad'
import type { GeometryBackend, GeometryRequest, MeshData } from '../geometry/types'

function numberParameter(request: GeometryRequest, id: string): number {
  const value = Number(request.parameters[id])
  if (!Number.isFinite(value)) {
    throw new Error(`Parameter "${id}" must be a finite number.`)
  }
  return value
}

function generateCylinder(request: GeometryRequest): MeshData {
  const height = numberParameter(request, 'height')
  const diameter = numberParameter(request, 'diameter')
  const wallThickness = numberParameter(request, 'wallThickness')

  if (height <= 0 || diameter <= 0) {
    throw new Error('Height and diameter must be greater than zero.')
  }
  if (wallThickness <= 0 || wallThickness >= diameter / 2) {
    throw new Error('Wall thickness must be greater than zero and less than half the diameter.')
  }

  const outer = makeCylinder(diameter / 2, height)
  const inner = makeCylinder(diameter / 2 - wallThickness, height + 0.2, [0, 0, -0.1])
  const mesh = outer.cut(inner).mesh({ tolerance: 0.15, angularTolerance: 0.15 })

  return {
    positions: new Float32Array(mesh.vertices),
    indices: new Uint32Array(mesh.triangles),
    normals: new Float32Array(mesh.normals),
  }
}

export const replicadBackend: GeometryBackend = {
  id: 'replicad',
  async generate(request) {
    if (request.operation !== 'parametric-cylinder') {
      throw new Error(`Unsupported Replicad operation: ${request.operation}`)
    }
    return generateCylinder(request)
  },
}
