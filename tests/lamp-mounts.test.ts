import { proceduralBackend } from '../src/cad/procedural-backend.ts'
import {
  deriveLampSeatGeometry,
  generateLampBase,
  type LampBaseMetadata,
  type LampHolderReferenceGeneration,
} from '../src/geometry/lampBase.ts'
import {
  createWaveLampProfileRing,
  generateWaveLampMesh,
} from '../src/geometry/waveLamp.ts'
import {
  parametricWaveLamp,
  waveLampBaseParameters,
  waveLampDecorativeParameters,
  type WaveLampParameterValues,
} from '../src/generators/wave-lamp.ts'
import { createConnectionFrame, type MeshData, type MeshPart } from '../src/geometry/types.ts'

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

function assertNear(actual: number, expected: number, message: string, tolerance = 1e-4): void {
  assert(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} !== ${expected}`)
}

function part(mesh: MeshData, id: string): MeshPart {
  const result = mesh.parts?.find((candidate) => candidate.id === id)
  if (!result) throw new Error(`Missing mesh part: ${id}`)
  return result
}

function finiteMesh(mesh: MeshData, label: string): void {
  assert(mesh.positions.length > 0 && mesh.indices.length > 0, `${label} must contain geometry.`)
  assert(Array.from(mesh.positions).every(Number.isFinite), `${label}: positions must be finite.`)
  assert(Array.from(mesh.indices).every(Number.isInteger), `${label}: indices must be integers.`)
  if (mesh.normals) assert(Array.from(mesh.normals).every(Number.isFinite), `${label}: normals must be finite.`)
}

function assertSameMesh(left: MeshData, right: MeshData, label: string): void {
  assert(left.positions.length === right.positions.length, `${label}: vertex counts differ.`)
  assert(left.indices.length === right.indices.length, `${label}: index counts differ.`)
  for (let index = 0; index < left.positions.length; index += 1) {
    assert(left.positions[index] === right.positions[index], `${label}: position ${index} differs.`)
  }
  for (let index = 0; index < left.indices.length; index += 1) {
    assert(left.indices[index] === right.indices[index], `${label}: index ${index} differs.`)
  }
}

function assertCircularRing(mesh: MeshData, segments: number, label: string): void {
  const firstRadius = Math.hypot(mesh.positions[0], mesh.positions[1])
  for (let column = 1; column < segments; column += 1) {
    const offset = column * 3
    assertNear(Math.hypot(mesh.positions[offset], mesh.positions[offset + 1]), firstRadius, `${label} radius ${column}`)
    assertNear(mesh.positions[offset + 2], mesh.positions[2], `${label} z ${column}`)
  }
}

const defaults = parametricWaveLamp.defaults
assert(parametricWaveLamp.validate(defaults).valid, `Wave Lamp defaults validate: ${parametricWaveLamp.validate(defaults).errors.join(' ')}`)
const parameterIds = parametricWaveLamp.parameters.map((parameter) => parameter.id)
for (const forbidden of ['mountType', 'nominalDiameter', 'pitch', 'length', 'clearance', 'handedness', 'rimDiameter', 'threadSpec', 'threadedHole', 'retainingRing']) {
  assert(!parameterIds.includes(forbidden), `${forbidden} is not exposed by Wave Lamp.`)
}
for (const required of ['seatMode', 'fitClearance', 'bottomThickness', 'pedestalDiameter', 'holderOpeningDiameter', 'cableChannelWidth', 'cableChannelDepth']) {
  assert(parameterIds.includes(required), `${required} is exposed by Wave Lamp.`)
}

const fixedFrame = createConnectionFrame(0, 58.8)
const directShade = generateWaveLampMesh(waveLampDecorativeParameters(defaults), {
  shadeInputFrame: fixedFrame,
  shadeSeat: waveLampBaseParameters(defaults).shadeSeat,
  adaptationHeight: defaults.bottomAdaptationHeight,
})
finiteMesh(directShade, 'Direct DecorativeShade')
const collarRing = createWaveLampProfileRing({
  parameters: waveLampDecorativeParameters(defaults),
  inputFrame: fixedFrame,
  normalizedHeight: 0,
  shadeSeat: waveLampBaseParameters(defaults).shadeSeat,
  adaptationHeight: defaults.bottomAdaptationHeight,
})
assert(collarRing.points.every((point) => point.radius === collarRing.points[0].radius), 'Bottom collar is circular.')
assert(collarRing.points.every((point) => Number.isFinite(point.angle)), 'Bottom collar angles are finite.')

const deformersChanged = generateWaveLampMesh({
  ...waveLampDecorativeParameters(defaults),
  waves: 64,
  amplitude: 40,
  twist: 360,
}, {
  shadeInputFrame: fixedFrame,
  shadeSeat: waveLampBaseParameters(defaults).shadeSeat,
  adaptationHeight: defaults.bottomAdaptationHeight,
})
const changedCollarRing = createWaveLampProfileRing({
  parameters: { ...waveLampDecorativeParameters(defaults), waves: 64, amplitude: 40, twist: 360 },
  inputFrame: fixedFrame,
  normalizedHeight: 0,
  shadeSeat: waveLampBaseParameters(defaults).shadeSeat,
  adaptationHeight: defaults.bottomAdaptationHeight,
})
assertSameMesh(
  { positions: directShade.positions.slice(0, defaults.radialSegments * 3), indices: new Uint32Array() },
  { positions: deformersChanged.positions.slice(0, defaults.radialSegments * 3), indices: new Uint32Array() },
  'Deformers do not affect the bottom collar',
)
assert(changedCollarRing.points.every((point, index) => point.radius === collarRing.points[index].radius), 'Deformers do not affect the collar profile.')

const defaultBaseParameters = waveLampBaseParameters(defaults)
const seat = deriveLampSeatGeometry(defaultBaseParameters)
const directBase = generateLampBase(defaultBaseParameters)
finiteMesh(directBase.mesh, 'Wave Lamp Base')
assert(directBase.geometry.bottomThickness === defaults.bottomThickness, 'Base records the real bottom thickness.')
assert(directBase.metadata.cablePassage.isLocal, 'Cable passage is local.')
assert(directBase.metadata.cablePassage.leavesStructure, 'Cable passage leaves base structure.')
assert(directBase.geometry.channelFloorZ >= defaults.bottomThickness, 'Cable channel leaves the solid floor.')
assert(Array.from(directBase.mesh.positions).some((value, index) => index % 3 === 2 && Math.abs(value - directBase.geometry.channelFloorZ) < 1e-4), 'Cable channel has a physical floor.')
assert(seat.baseSeatOuterDiameter > seat.baseSeatInnerDiameter, 'Peripheral base seat is annular.')

const assembly = await proceduralBackend.generate({ backend: 'procedural', operation: 'wave-lamp', parameters: defaults })
finiteMesh(assembly, 'Wave Lamp assembly')
assert(JSON.stringify(assembly.parts?.map((candidate) => candidate.id)) === JSON.stringify(['base', 'decorative-shade', 'lamp-holder-reference']), 'Assembly has Base, DecorativeShade, and LampHolderReference parts.')
const basePart = part(assembly, 'base')
const shadePart = part(assembly, 'decorative-shade')
const holderPart = part(assembly, 'lamp-holder-reference')
finiteMesh(basePart.mesh, 'Base part')
finiteMesh(shadePart.mesh, 'DecorativeShade part')
finiteMesh(holderPart.mesh, 'LampHolderReference part')
assert(basePart.outputFrame !== undefined && shadePart.inputFrame !== undefined, 'Shade connects to the base through the peripheral seat.')
assertNear(basePart.outputFrame?.position.z ?? Number.NaN, shadePart.inputFrame?.position.z ?? Number.NaN, 'Peripheral seat z')
assertNear(basePart.outputFrame?.radius ?? Number.NaN, shadePart.inputFrame?.radius ?? Number.NaN, 'Peripheral seat radius')
assert((basePart.outputFrame?.radius ?? 0) > (part(assembly, 'base').inputFrame?.radius ?? 0) * 0.8, 'Shade seat is peripheral.')
assert(holderPart.inputFrame !== undefined, 'Holder reference has an independent central frame.')
assert((holderPart.inputFrame?.radius ?? Number.POSITIVE_INFINITY) < (shadePart.inputFrame?.radius ?? 0), 'Central holder frame is not the shade connection.')
const baseMetadata = (basePart.mesh as MeshData & { lampBaseMetadata: LampBaseMetadata }).lampBaseMetadata
assert(baseMetadata.printable, 'Base is printable.')
const holderMetadata = (holderPart.mesh as MeshData & { lampHolderMetadata: LampHolderReferenceGeneration['metadata'] }).lampHolderMetadata
assert(holderMetadata.referenceOnly && !holderMetadata.printable, 'LampHolderReference is visual only.')

const recessed = await proceduralBackend.generate({ backend: 'procedural', operation: 'wave-lamp', parameters: { ...defaults, seatMode: 'recessed-seat' } })
const raised = await proceduralBackend.generate({ backend: 'procedural', operation: 'wave-lamp', parameters: { ...defaults, seatMode: 'raised-lip' } })
const recessedMetadata = (part(recessed, 'base').mesh as MeshData & { lampBaseMetadata: LampBaseMetadata }).lampBaseMetadata
const raisedMetadata = (part(raised, 'base').mesh as MeshData & { lampBaseMetadata: LampBaseMetadata }).lampBaseMetadata
assert(recessedMetadata.seat.baseSeatInnerDiameter < recessedMetadata.shadeSeat.collarOuterDiameter + defaults.fitClearance * 2, 'Recessed seat receives the collar.')
assert(recessedMetadata.shadeSeat.collarOuterDiameter <= recessedMetadata.seat.baseSeatOuterDiameter, 'Recessed collar fits the peripheral seat.')
assert(raisedMetadata.seat.lipOuterDiameter + defaults.fitClearance <= raisedMetadata.shadeSeat.collarInnerDiameter, 'Raised lip enters the shade collar.')
assert(raisedMetadata.seat.lipOuterDiameter > raisedMetadata.seat.lipInnerDiameter, 'Raised lip remains circular and annular.')

const mechanicalVariant: WaveLampParameterValues = {
  ...defaults,
  baseDiameter: 180,
  baseThickness: 12,
  bottomThickness: 5,
  pedestalDiameter: 60,
  pedestalHeight: 40,
  holderOpeningDiameter: 24,
  cableChannelWidth: 12,
  cableChannelDepth: 6,
}
assert(parametricWaveLamp.validate(mechanicalVariant).valid, `Mechanical variant validates: ${parametricWaveLamp.validate(mechanicalVariant).errors.join(' ')}`)
const mechanicalShade = generateWaveLampMesh(waveLampDecorativeParameters(mechanicalVariant), {
  shadeInputFrame: fixedFrame,
  shadeSeat: waveLampBaseParameters(mechanicalVariant).shadeSeat,
  adaptationHeight: mechanicalVariant.bottomAdaptationHeight,
})
assertSameMesh(directShade, mechanicalShade, 'Base and holder changes do not alter DecorativeShade')
const mechanicalAssembly = await proceduralBackend.generate({ backend: 'procedural', operation: 'wave-lamp', parameters: mechanicalVariant })
const mechanicalShadePart = part(mechanicalAssembly, 'decorative-shade')
for (let index = defaults.radialSegments * 3; index < shadePart.mesh.positions.length; index += 3) {
  assertNear(shadePart.mesh.positions[index], mechanicalShadePart.mesh.positions[index], 'Shade body x remains unchanged under base mechanics', 1e-4)
  assertNear(shadePart.mesh.positions[index + 1], mechanicalShadePart.mesh.positions[index + 1], 'Shade body y remains unchanged under base mechanics', 1e-4)
  assertNear(
    shadePart.mesh.positions[index + 2] - (shadePart.inputFrame?.position.z ?? 0),
    mechanicalShadePart.mesh.positions[index + 2] - (mechanicalShadePart.inputFrame?.position.z ?? 0),
    'Shade body z remains unchanged under base mechanics',
    1e-4,
  )
}

assertCircularRing(directShade, defaults.radialSegments, 'Decorative collar ring')
console.log('Wave Lamp peripheral mechanical redesign tests passed.')
