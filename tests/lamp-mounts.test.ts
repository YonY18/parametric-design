import { parametricWaveLamp } from '../src/generators/wave-lamp.ts'
import { proceduralBackend } from '../src/cad/procedural-backend.ts'
import { deriveRimInterface, validateRimInterface } from '../src/geometry/rimInterface.ts'
import type { MeshData, MeshPart } from '../src/geometry/types.ts'

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
  assert(mesh.positions.length > 0 && mesh.indices.length > 0, `${label} must contain geometry.`)
  assert(Array.from(mesh.positions).every(Number.isFinite), `${label}: positions must be finite.`)
  assert(Array.from(mesh.indices).every(Number.isInteger), `${label}: indices must be integers.`)
  if (mesh.normals) assert(Array.from(mesh.normals).every(Number.isFinite), `${label}: normals must be finite.`)
}

function assertCircularRings(mesh: MeshData, segments: number, label: string): void {
  const vertexCount = mesh.positions.length / 3
  assert(vertexCount % segments === 0, `${label} must contain complete radial rings.`)
  for (let start = 0; start < vertexCount; start += segments) {
    const first = Math.hypot(mesh.positions[start * 3], mesh.positions[start * 3 + 1])
    for (let column = 1; column < segments; column += 1) {
      const offset = (start + column) * 3
      assertNear(
        Math.hypot(mesh.positions[offset], mesh.positions[offset + 1]),
        first,
        `${label} ring ${start / segments} is circular`,
        1e-4,
      )
    }
  }
}

function assertSameMesh(left: MeshData, right: MeshData, label: string): void {
  assert(left.positions.length === right.positions.length, `${label}: vertex counts differ.`)
  assert(left.indices.length === right.indices.length, `${label}: index counts differ.`)
  for (let index = 0; index < left.positions.length; index += 1) {
    assertNear(left.positions[index], right.positions[index], `${label} position ${index}`, 1e-6)
  }
  for (let index = 0; index < left.indices.length; index += 1) {
    assert(left.indices[index] === right.indices[index], `${label} index ${index} differs.`)
  }
}

const defaults = parametricWaveLamp.defaults
const defaultValidation = parametricWaveLamp.validate(defaults)
assert(defaultValidation.valid, `Default Wave Lamp should validate: ${defaultValidation.errors.join(' ')}`)

const parameterIds = parametricWaveLamp.parameters.map((parameter) => parameter.id)
for (const id of ['height', 'bottomDiameter', 'topDiameter', 'wallThickness', 'waves', 'amplitude', 'twist', 'rimDiameter', 'rimHeight', 'rimThickness', 'rimLipDepth', 'rimClearance']) {
  assert(parameterIds.includes(id), `Reduced Wave Lamp parameter ${id} is exposed.`)
}
for (const id of ['baseType', 'threadEnabled', 'mountType', 'patternCount', 'patternAmplitude', 'twistAngle', 'rimFitClearance']) {
  assert(!parameterIds.includes(id), `Legacy assembly/deformer parameter ${id} stays hidden.`)
}

const rim = deriveRimInterface({
  rimDiameter: defaults.rimDiameter,
  rimHeight: defaults.rimHeight,
  rimThickness: defaults.rimThickness,
  rimLipDepth: defaults.rimLipDepth,
  rimClearance: defaults.rimClearance,
})
assert(validateRimInterface(rim).valid, 'Independent RimInterface validates.')
assertNear(rim.rimOuterDiameter, defaults.rimDiameter, 'Rim diameter is explicit')

const defaultAssembly = await proceduralBackend.generate({ backend: 'procedural', operation: 'wave-lamp', parameters: defaults })
finiteMesh(defaultAssembly, 'Wave Lamp assembly')
assert(
  JSON.stringify(defaultAssembly.parts?.map((candidate) => candidate.id)) === JSON.stringify(['rim-interface', 'decorative-shade']),
  'Wave Lamp contains only RimInterface and DecorativeShade.',
)
for (const id of ['generic-base', 'mount-feature', 'threaded-hub', 'retaining-ring', 'internal-support']) {
  assert(!defaultAssembly.parts?.some((candidate) => candidate.id === id), `${id} does not participate in Wave Lamp.`)
}

const rimPart = part(defaultAssembly, 'rim-interface')
const shadePart = part(defaultAssembly, 'decorative-shade')
finiteMesh(rimPart.mesh, 'RimInterface')
finiteMesh(shadePart.mesh, 'DecorativeShade')
assertCircularRings(rimPart.mesh, defaults.radialSegments, 'RimInterface')
assert(rimPart.outputFrame && shadePart.inputFrame, 'Rim and shade expose a mounting join.')
if (rimPart.outputFrame && shadePart.inputFrame) {
  assertNear(rimPart.outputFrame.position.z, shadePart.inputFrame.position.z, 'Rim/shade join height')
  assertNear(rimPart.outputFrame.radius, shadePart.inputFrame.radius, 'Rim/shade join radius')
}

// The first shade ring is circular, untwisted, and exactly seated on the rim.
const rimRadius = defaults.rimDiameter / 2
for (let column = 0; column < defaults.radialSegments; column += 1) {
  const offset = column * 3
  const angle = (Math.PI * 2 * column) / defaults.radialSegments
  assertNear(shadePart.mesh.positions[offset], Math.cos(angle) * rimRadius, `Shade mounting x ${column}`, 1e-4)
  assertNear(shadePart.mesh.positions[offset + 1], Math.sin(angle) * rimRadius, `Shade mounting y ${column}`, 1e-4)
}

// Wave count, amplitude, and twist cannot change the circular rim mesh.
const extremeAssembly = await proceduralBackend.generate({
  backend: 'procedural',
  operation: 'wave-lamp',
  parameters: { ...defaults, waves: 64, amplitude: 40, twist: 360 },
})
const extremeRimPart = part(extremeAssembly, 'rim-interface')
assertSameMesh(rimPart.mesh, extremeRimPart.mesh, 'RimInterface remains identical under deformers')
assert(
  JSON.stringify(extremeAssembly.parts?.map((candidate) => candidate.id)) === JSON.stringify(['rim-interface', 'decorative-shade']),
  'Extreme deformers do not add mechanical parts.',
)

// Shade dimensions are independent too: only the shade body changes when its diameters change.
const resizedAssembly = await proceduralBackend.generate({
  backend: 'procedural',
  operation: 'wave-lamp',
  parameters: { ...defaults, bottomDiameter: 220, topDiameter: 180 },
})
assertSameMesh(rimPart.mesh, part(resizedAssembly, 'rim-interface').mesh, 'RimInterface remains independent of shade dimensions')

console.log('Wave Lamp + RimInterface stabilization tests passed.')
