import { parametricWaveLamp } from '../src/generators/wave-lamp.ts'
import { proceduralBackend } from '../src/cad/procedural-backend.ts'
import { createConnectionFrame, type MeshData, type MeshPart } from '../src/geometry/types.ts'
import { createWaveLampProfileRing, generateWaveLampMesh } from '../src/geometry/waveLamp.ts'
import { validateInternalShadeSupport } from '../src/geometry/internalShadeSupport.ts'
import { validateThreadedHub } from '../src/geometry/threadedHub.ts'
import { deriveRetainingRingParameters, resolveAttachmentInterface } from '../src/geometry/attachmentInterface.ts'

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
  mountType: 'generic-threaded' as const,
  mountPreset: '60',
  ...overrides,
})

const defaultValidation = parametricWaveLamp.validate(defaults)
assert(defaultValidation.valid, `Default Wave Lamp should validate: ${defaultValidation.errors.join(' ')}`)
const defaultShade = generateWaveLampMesh(defaults)
assert(defaultShade.positions.length > 0 && defaultShade.indices.length > 0, 'Default decorative shade generates mesh data.')
assert(defaultShade.positions[2] === 0, 'Unmounted decorative shade starts at global Z=0.')

const mounted = mountedParameters()
const mountedValidation = parametricWaveLamp.validate(mounted)
assert(mountedValidation.valid, `Mounted Wave Lamp should validate: ${mountedValidation.errors.join(' ')}`)
const mountedMesh = await proceduralBackend.generate({
  backend: 'procedural',
  operation: 'wave-lamp',
  parameters: mounted,
})
const expectedPartIds = ['mount', 'mount-seat', 'threaded-hub', 'internal-support', 'decorative-shade', 'retaining-ring']
for (const id of expectedPartIds) assert(Boolean(mountedMesh.parts?.some((candidate) => candidate.id === id)), `Mounted assembly exposes ${id}.`)
assert(!mountedMesh.parts?.some((candidate) => candidate.id === 'transition'), 'Mounted assembly does not create a decorative transition.')
assert(!mountedMesh.parts?.some((candidate) => candidate.id === 'shade-neck'), 'Mounted assembly does not create a shade neck.')
finiteMesh(mountedMesh, 'Mounted assembly')
for (const candidate of mountedMesh.parts ?? []) {
  finiteMesh(candidate.mesh, candidate.id)
  if (candidate.id === 'threaded-hub' || candidate.id === 'internal-support') assertNoBadTriangles(candidate.mesh, candidate.id)
}

const decorative = part(mountedMesh, 'decorative-shade')
const support = part(mountedMesh, 'internal-support')
const hub = part(mountedMesh, 'threaded-hub')
const ring = part(mountedMesh, 'retaining-ring')
const radialSegments = Number(mounted.radialSegments)
const supportMarker = mountedMesh.profileRings?.find((marker) => marker.id === 'decorative-shade:support-interior-profile')
assert(Boolean(supportMarker), 'Mounted assembly exposes the actual support interior profile.')
if (!supportMarker) throw new Error('Support interior profile marker is missing.')

const expectedDecorative = generateWaveLampMesh(mounted, {
  shadeInputFrame: createConnectionFrame(decorative.inputFrame?.position.z ?? 0, Number(mounted.bottomDiameter) / 2),
})
assertExteriorEqual(decorative.mesh, expectedDecorative, 'Decorative Shade keeps the normal deformation')
assert(radialRange(hub.mesh, 0, radialSegments).max - radialRange(hub.mesh, 0, radialSegments).min < 1e-5, 'Threaded Hub outer ring remains circular.')
assert(radialRange(hub.mesh, radialSegments * 2, radialSegments).max - radialRange(hub.mesh, radialSegments * 2, radialSegments).min < 1e-5, 'Threaded Hub inner opening remains circular.')

const supportOuterVertexCount = radialSegments
for (let column = 0; column < supportOuterVertexCount; column += 1) {
  const supportOffset = column * 3
  const supportRadius = Math.hypot(support.mesh.positions[supportOffset], support.mesh.positions[supportOffset + 1])
  const profilePoint = supportMarker.ring.points[column]
  assertNear(supportRadius, profilePoint.radius, `Internal Support reaches the shade inner profile at column ${column}`)
  assertNear(support.mesh.positions[supportOffset], Math.cos(profilePoint.angle) * profilePoint.radius, `Internal Support X joins the shade profile at column ${column}`)
  assertNear(support.mesh.positions[supportOffset + 1], Math.sin(profilePoint.angle) * profilePoint.radius, `Internal Support Y joins the shade profile at column ${column}`)
  assert(profilePoint.radius < Number(mounted.bottomDiameter), 'Internal Support does not exceed the shade exterior.')
}
assertNear(
  Math.min(...Array.from(support.mesh.positions).filter((_, offset) => offset % 3 === 2)),
  (decorative.inputFrame?.position.z ?? 0) + Number(mounted.supportInset),
  'supportInset positions the plate',
)
assert(supportMarker.ring.points.every((point) => point.radius > 0), 'Internal Support has no negative or zero interior radii.')
assert(validateInternalShadeSupport({
  supportType: '3-arm',
  supportInset: 10,
  supportThickness: 2,
  hubOuterDiameter: 46,
  shadeWallThickness: 1.2,
  radialSegments,
}).valid === false, 'Unsupported Internal Shade Support modes are rejected.')
assert(validateThreadedHub({
  hubOuterDiameter: 46,
  hubHeight: 12,
  hubWallThickness: 2,
  threadDiameter: 40,
  threadPitch: 2,
  threadLength: 12,
  threadClearance: 0.2,
  threadDirection: 'right',
  radialSegments,
}).valid, 'Threaded Hub defaults validate.')

const hubDiameterVariant = await proceduralBackend.generate({
  backend: 'procedural',
  operation: 'wave-lamp',
  parameters: mountedParameters({ hubOuterDiameter: 50 }),
})
assertExteriorEqual(part(hubDiameterVariant, 'decorative-shade').mesh, decorative.mesh, 'hubOuterDiameter does not change decorative exterior profile')

const legacyTransitionVariant = await proceduralBackend.generate({
  backend: 'procedural',
  operation: 'wave-lamp',
  parameters: mountedParameters({
    blendHeight: 180,
    decorativeStartRadius: 18,
    transitionStartRadius: 18,
    transitionEndRadius: 18,
    transitionHeight: 120,
  }),
})
assertExteriorEqual(part(legacyTransitionVariant, 'decorative-shade').mesh, decorative.mesh, 'Mounted legacy transition controls do not funnel the shade to the mount')

const threadVariant = await proceduralBackend.generate({
  backend: 'procedural',
  operation: 'wave-lamp',
  parameters: mountedParameters({ attachmentThreadDiameter: 36, attachmentFlangeRadialClearance: 0.5 }),
})
assertExteriorEqual(part(threadVariant, 'decorative-shade').mesh, decorative.mesh, 'threadDiameter does not change decorative exterior profile')

const mountVariant = await proceduralBackend.generate({
  backend: 'procedural',
  operation: 'wave-lamp',
  parameters: mountedParameters({ mountOuterDiameter: 70, mountHeight: 30 }),
})
assertExteriorEqual(part(mountVariant, 'decorative-shade').mesh, decorative.mesh, 'Mount size variations do not deform shade exterior')

const ringVariant = await proceduralBackend.generate({
  backend: 'procedural',
  operation: 'wave-lamp',
  parameters: mountedParameters({ bottomDiameter: 220, topDiameter: 180 }),
})
assertExteriorEqual(part(ringVariant, 'retaining-ring').mesh, ring.mesh, 'Retaining Ring depends on AttachmentInterface, not decorative diameter')
const ringRadii = radialRange(ring.mesh, 0, 64)
assert(ringRadii.max < Number(mounted.bottomDiameter) / 2, 'Retaining Ring remains compact around the attachment interface.')

const attachment = resolveAttachmentInterface(mounted)
const ringParameters = deriveRetainingRingParameters(attachment, {
  gripStyle: 'smooth',
  gripDepth: 0,
  gripCount: 12,
})
assert(ringParameters.outerDiameter < Number(mounted.bottomDiameter), 'Retaining Ring dimensions do not use the decorative diameter.')

const supportZ = decorative.inputFrame?.position.z ?? 0
const directSupportProfile = createWaveLampProfileRing({
  parameters: mounted,
  inputFrame: createConnectionFrame(supportZ, Number(mounted.bottomDiameter) / 2),
  normalizedHeight: Number(mounted.supportInset) / Number(mounted.height),
})
assertNear(directSupportProfile.z, supportZ + Number(mounted.supportInset), 'Support profile is evaluated at supportInset')
assertNear(supportMarker.ring.z, directSupportProfile.z, 'Support profile marker has the support plane Z')

const invalidSupport = parametricWaveLamp.validate(mountedParameters({ supportType: '4-arm' }))
assert(!invalidSupport.valid && invalidSupport.errors.some((error) => error.includes('only annular')), 'Unsupported supportType is rejected by the Wave Lamp validator.')
const invalidHub = parametricWaveLamp.validate(mountedParameters({ hubOuterDiameter: 40 }))
assert(!invalidHub.valid && invalidHub.errors.some((error) => error.includes('Threaded Hub')), 'Threaded Hub dimensions reject a non-positive wall.')
const invalidInset = parametricWaveLamp.validate(mountedParameters({ supportInset: Number(mounted.height) }))
assert(!invalidInset.valid && invalidInset.errors.some((error) => error.includes('inside')), 'Support inset outside the shade is rejected.')

assert(Array.from(mountedMesh.positions).every((value) => Number.isFinite(value)), 'Mounted mesh contains no NaN or Infinity.')
assert(Array.from(mountedMesh.positions).every((value, offset) => offset % 3 !== 2 || Number.isFinite(value)), 'Mounted Z coordinates are finite.')
console.log('Lamp mount redesign tests passed.')
