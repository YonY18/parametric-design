import { deriveMechanicalCore } from '../src/geometry/mechanicalCore.ts'
import { retainingRingDefinition } from '../src/geometry/retainingRing.ts'
import { generateThreadedHub } from '../src/geometry/threadedHub.ts'
import {
  createThreadSpec,
  deriveThreadTurns,
  validateThreadSpec,
  type ThreadSpec,
} from '../src/geometry/threadSpec.ts'
import { createConnectionFrame, type MeshData } from '../src/geometry/types.ts'

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

function finiteMesh(mesh: MeshData, label: string): void {
  assert(mesh.positions.length > 0, `${label} must contain vertices.`)
  assert(mesh.indices.length > 0, `${label} must contain triangles.`)
  assert(Array.from(mesh.positions).every(Number.isFinite), `${label} positions must be finite.`)
  assert(Array.from(mesh.indices).every(Number.isInteger), `${label} indices must be integers.`)
}

const spec: ThreadSpec = createThreadSpec({
  nominalDiameter: 40,
  pitch: 2,
  length: 12,
  depth: 0.5,
  clearance: 0.2,
  handedness: 'right',
  profileType: 'metric-like triangular',
})

assert(validateThreadSpec(spec).valid, 'ThreadSpec validates.')
assert(deriveThreadTurns(spec) === 6, 'ThreadSpec derives a finite number of turns.')

const core = deriveMechanicalCore({
  mountType: 'threaded',
  threadSpec: spec,
  cableHoleDiameter: 10,
  supportInset: 10,
  supportThickness: 2,
  wallThickness: 1.2,
  height: 180,
  radialSegments: 64,
})
assert(core.threadSpec.nominalDiameter === spec.nominalDiameter, 'Mechanical core retains the canonical thread spec.')
assert(core.hub.threadSpec === core.threadSpec, 'Threaded Hub receives the canonical ThreadSpec object.')
assert(core.ring.threadSpec === core.threadSpec, 'Retaining Ring receives the canonical ThreadSpec object.')
assert(core.hub.threadPitch === spec.pitch, 'Derived Hub pitch comes from ThreadSpec.')
assert(core.ring.threadPitch === spec.pitch, 'Derived Ring pitch comes from ThreadSpec.')
assert(core.ring.threadClearance === spec.clearance, 'Derived Ring clearance comes from ThreadSpec.')

const hub = generateThreadedHub(core.hub, createConnectionFrame(0, core.dimensions.hubOuterDiameter / 2))
const ring = retainingRingDefinition.generate(core.ring, createConnectionFrame(0, core.dimensions.ringOuterDiameter / 2))
finiteMesh(hub.mesh, 'Threaded Hub')
finiteMesh(ring.mesh, 'Retaining Ring')
assert(hub.threadedConnection.profileType === spec.profileType, 'Hub reports the canonical thread profile.')
assert(ring.internalThread.profileType === spec.profileType, 'Ring reports the canonical thread profile.')
assert(hub.threadedConnection.direction === spec.handedness, 'Hub reports ThreadSpec handedness.')
assert(ring.internalThread.direction === spec.handedness, 'Ring reports ThreadSpec handedness.')
assert(hub.mesh.positions.length > 64 * 4 * 3, 'Hub includes a helical thread surface.')
assert(ring.mesh.positions.length > 64 * 4 * 3, 'Ring includes a helical thread surface.')

console.log('ThreadSpec tests passed.')
