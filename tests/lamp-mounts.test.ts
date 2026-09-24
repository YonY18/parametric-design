import { parametricWaveLamp } from '../src/generators/wave-lamp.ts'
import { proceduralBackend } from '../src/cad/procedural-backend.ts'
import { deriveMechanicalCore } from '../src/geometry/mechanicalCore.ts'
import { createConnectionFrame, type MeshData, type MeshPart } from '../src/geometry/types.ts'
import { generateWaveLampMesh } from '../src/geometry/waveLamp.ts'
import { validateInternalShadeSupport } from '../src/geometry/internalShadeSupport.ts'
import { validateRetainingRing } from '../src/geometry/retainingRing.ts'
import { validateThreadedHub } from '../src/geometry/threadedHub.ts'

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

function assertNear(actual: number, expected: number, message: string, tolerance = 1e-5): void {
  assert(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} !== ${expected}`)
}

function part(mesh: MeshData, id: string): MeshPart {
  const result = mesh.parts?.find((candidate) => candidate.id === id)
  if (!result) throw new Error(`Missing mesh part: ${id}`)
  return result
}

function finiteMesh(mesh: MeshData, label: string): void {
  assert(Array.from(mesh.positions).every(Number.isFinite), `${label}: positions must be finite.`)
  assert(Array.from(mesh.indices).every(Number.isInteger), `${label}: indices must be integers.`)
  if (mesh.normals) assert(Array.from(mesh.normals).every(Number.isFinite), `${label}: normals must be finite.`)
}

function assertNoBadTriangles(mesh: MeshData, label: string): void {
  for (let index = 0; index < mesh.indices.length; index += 3) {
    const vertices = [mesh.indices[index], mesh.indices[index + 1], mesh.indices[index + 2]]
    const points = vertices.map((vertex) => [
      mesh.positions[vertex * 3],
      mesh.positions[vertex * 3 + 1],
      mesh.positions[vertex * 3 + 2],
    ])
    const ab = points[1].map((value, axis) => value - points[0][axis])
    const ac = points[2].map((value, axis) => value - points[0][axis])
    const area = Math.hypot(
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ) / 2
    assert(area > 1e-8, `${label}: triangle ${index / 3} is degenerate.`)
  }
}

function radialRange(mesh: MeshData, start: number, count: number): { min: number; max: number } {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (let vertex = start; vertex < start + count; vertex += 1) {
    const offset = vertex * 3
    const radius = Math.hypot(mesh.positions[offset], mesh.positions[offset + 1])
    min = Math.min(min, radius)
    max = Math.max(max, radius)
  }
  return { min, max }
}

function assertExteriorEqual(left: MeshData, right: MeshData, message: string): void {
  assert(left.positions.length === right.positions.length, `${message}: vertex counts differ.`)
  const zOffset = left.positions[2] - right.positions[2]
  for (let offset = 0; offset < left.positions.length; offset += 3) {
    assertNear(left.positions[offset], right.positions[offset], `${message}: X at vertex ${offset / 3}`)
    assertNear(left.positions[offset + 1], right.positions[offset + 1], `${message}: Y at vertex ${offset / 3}`)
    assertNear(left.positions[offset + 2] - right.positions[offset + 2], zOffset, `${message}: Z offset at vertex ${offset / 3}`)
  }
}

const defaults = parametricWaveLamp.defaults
const mountedParameters = (overrides: Record<string, number | string | boolean> = {}) => ({
  ...defaults,
  mountType: 'threaded' as const,
  ...overrides,
})

const schemaIds = parametricWaveLamp.parameters.map((parameter) => parameter.id)
const legacyIds = schemaIds.filter((id) => id !== 'mountType'
  && /^(mount|retainingRing|attachment|shadeNeck|transition)/.test(id))
assert(legacyIds.length === 0, `Normal schema exposes legacy parameters: ${legacyIds.join(', ')}`)
assert(schemaIds.includes('maxDiameter'), 'Normal schema exposes maxDiameter.')
assert(schemaIds.includes('nominalThreadDiameter'), 'Normal schema exposes nominalThreadDiameter.')

const defaultValidation = parametricWaveLamp.validate(defaults)
assert(defaultValidation.valid, `Default Wave Lamp should validate: ${defaultValidation.errors.join(' ')}`)
const defaultShade = generateWaveLampMesh(defaults)
finiteMesh(defaultShade, 'Decorative shade')
assertNoBadTriangles(defaultShade, 'Decorative shade')
assert(defaultShade.positions[2] === 0, 'Decorative shade starts at global Z=0.')

const coreInput = {
  mountType: 'threaded' as const,
  nominalThreadDiameter: defaults.nominalThreadDiameter,
  threadPitch: defaults.threadPitch,
  threadClearance: defaults.threadClearance,
  cableHoleDiameter: defaults.cableHoleDiameter,
  supportInset: defaults.supportInset,
  supportThickness: defaults.supportThickness,
  wallThickness: defaults.wallThickness,
  height: defaults.height,
  radialSegments: defaults.radialSegments,
  maxDiameter: defaults.maxDiameter,
}
const core = deriveMechanicalCore(coreInput)
assert(core.dimensions.hubOuterDiameter > core.dimensions.hubOpeningDiameter, 'Mechanical Core derives hub body dimensions.')
assert(core.dimensions.ringOuterDiameter > core.dimensions.ringInnerDiameter, 'Mechanical Core derives retaining ring dimensions.')
assert(core.dimensions.supportOuterDiameter > core.dimensions.supportInnerDiameter, 'Mechanical Core derives support dimensions.')
assert(validateThreadedHub(core.hub).valid, 'Derived Threaded Hub parameters validate.')
assert(validateRetainingRing(core.ring).valid, 'Derived Retaining Ring parameters validate.')
assert(validateInternalShadeSupport(core.support).valid, 'Derived annular Internal Support parameters validate.')

const mounted = mountedParameters()
const mountedValidation = parametricWaveLamp.validate(mounted)
assert(mountedValidation.valid, `Mounted Wave Lamp should validate: ${mountedValidation.errors.join(' ')}`)
const mountedMesh = await proceduralBackend.generate({
  backend: 'procedural',
  operation: 'wave-lamp',
  parameters: mounted,
})
const expectedPartIds = ['decorative-shade', 'internal-support', 'threaded-hub', 'retaining-ring']
assert(
  JSON.stringify(mountedMesh.parts?.map((candidate) => candidate.id)) === JSON.stringify(expectedPartIds),
  'Threaded assembly exposes only the three rescue layers.',
)
assert(!mountedMesh.parts?.some((candidate) => ['mount', 'mount-seat', 'transition', 'shade-neck'].includes(candidate.id)), 'Rescue assembly does not create legacy parts.')
finiteMesh(mountedMesh, 'Threaded assembly')
for (const candidate of mountedMesh.parts ?? []) {
  finiteMesh(candidate.mesh, candidate.id)
  assertNoBadTriangles(candidate.mesh, candidate.id)
}

const decorative = part(mountedMesh, 'decorative-shade')
const support = part(mountedMesh, 'internal-support')
const hub = part(mountedMesh, 'threaded-hub')
const radialSegments = Number(mounted.radialSegments)
const supportMarker = mountedMesh.profileRings?.find((marker) => marker.id === 'decorative-shade:support-interior-profile')
assert(Boolean(supportMarker), 'Threaded assembly exposes the actual support interior profile.')
if (!supportMarker) throw new Error('Support interior profile marker is missing.')

const expectedDecorative = generateWaveLampMesh(mounted, {
  shadeInputFrame: createConnectionFrame(decorative.inputFrame?.position.z ?? 0, Number(mounted.maxDiameter) / 2),
})
assertExteriorEqual(decorative.mesh, expectedDecorative, 'Decorative Shade keeps the normal deformation')
assert(radialRange(hub.mesh, 0, radialSegments).max - radialRange(hub.mesh, 0, radialSegments).min < 1e-5, 'Threaded Hub outer ring remains circular.')
assert(radialRange(hub.mesh, radialSegments * 2, radialSegments).max - radialRange(hub.mesh, radialSegments * 2, radialSegments).min < 1e-5, 'Threaded Hub central opening remains circular.')

for (let column = 0; column < radialSegments; column += 1) {
  const supportOffset = column * 3
  const supportRadius = Math.hypot(support.mesh.positions[supportOffset], support.mesh.positions[supportOffset + 1])
  const profilePoint = supportMarker.ring.points[column]
  assertNear(supportRadius, profilePoint.radius, `Internal Support reaches the shade inner profile at column ${column}`)
  assert(profilePoint.radius > 0, 'Internal Support has no negative interior radii.')
}
assertNear(
  Math.min(...Array.from(support.mesh.positions).filter((_, offset) => offset % 3 === 2)),
  Number(mounted.supportInset),
  'Support inset positions the plate',
)

const threadVariant = await proceduralBackend.generate({
  backend: 'procedural',
  operation: 'wave-lamp',
  parameters: mountedParameters({ nominalThreadDiameter: 36, threadPitch: 1.5 }),
})
assertExteriorEqual(part(threadVariant, 'decorative-shade').mesh, decorative.mesh, 'Mechanical dimensions do not deform the exterior shade')

assert(!parametricWaveLamp.validate(mountedParameters({ cableHoleDiameter: 41 })).valid, 'Oversized cable holes are rejected.')
assert(parametricWaveLamp.validate(mountedParameters({ cableHoleDiameter: 41 })).errors.some((error) => error === 'Cable hole too large for selected hub.'), 'Cable validation is short and clear.')
assert(parametricWaveLamp.validate({ ...defaults, topDiameter: 40, waveAmplitude: 20 }).errors.includes('Wave amplitude too large for current wall thickness.'), 'Wave amplitude validation is short and clear.')
assert(parametricWaveLamp.validate(mountedParameters({ nominalThreadDiameter: 80 })).errors.includes('Support plate would not reach the shade inner wall.'), 'Support reach validation is short and clear.')
assert(parametricWaveLamp.validate(mountedParameters({ supportInset: Number(mounted.height) })).errors.some((error) => error.includes('inside the shade')), 'Support inset outside the shade is rejected.')
assert(validateInternalShadeSupport({
  supportType: '3-arm',
  supportInset: 10,
  supportThickness: 2,
  hubOuterDiameter: 46,
  shadeWallThickness: 1.2,
  radialSegments,
}).valid === false, 'Unsupported Internal Shade Support modes are rejected.')

console.log('Lamp rescue architecture tests passed.')
