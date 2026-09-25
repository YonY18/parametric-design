import type { ParameterValues, ValidationResult } from '../parametric/types'
import { createConnectionFrame, validateMeshData, type ConnectionFrame, type MeshData } from './types'

export type WaveLampSeatMode = 'recessed-seat' | 'raised-lip'

export interface WaveLampShadeSeat {
  seatDiameter: number
  collarOuterDiameter: number
  collarInnerDiameter: number
  collarWallThickness: number
}

export interface LampBaseParameters {
  baseDiameter: number
  baseThickness: number
  bottomThickness: number
  seatMode: WaveLampSeatMode
  fitClearance: number
  pedestalDiameter: number
  pedestalHeight: number
  holderOpeningDiameter: number
  cableChannelWidth: number
  cableChannelDepth: number
  radialSegments: number
  shadeSeat: WaveLampShadeSeat
}

export interface LampSeatGeometry {
  baseSeatInnerDiameter: number
  baseSeatOuterDiameter: number
  seatFloorZ: number
  seatDepth: number
  lipInnerDiameter: number
  lipOuterDiameter: number
  lipHeight: number
}

export interface LampBaseGeometry {
  outerRadius: number
  topZ: number
  bottomThickness: number
  channelFloorZ: number
  pedestalOuterRadius: number
  pedestalInnerRadius: number
  pedestalTopZ: number
  seat: LampSeatGeometry
}

export interface LampBaseMetadata {
  kind: 'wave-lamp-base'
  printable: true
  bottomThickness: number
  baseThickness: number
  shadeSeat: WaveLampShadeSeat
  seat: LampSeatGeometry
  pedestal: {
    outerDiameter: number
    holderOpeningDiameter: number
    topZ: number
  }
  cablePassage: {
    width: number
    depth: number
    floorZ: number
    startRadius: number
    endRadius: number
    isLocal: true
    leavesStructure: true
  }
}

export interface LampBaseGeneration extends MeshData {
  mesh: MeshData
  geometry: LampBaseGeometry
  metadata: LampBaseMetadata
  inputFrame: ConnectionFrame
  outputFrame: ConnectionFrame
  shadeSeatFrame: ConnectionFrame
  pedestalFrame: ConnectionFrame
  cableChannelFrame: ConnectionFrame
}

export interface LampHolderReferenceGeneration extends MeshData {
  mesh: MeshData
  metadata: {
    kind: 'lamp-holder-reference'
    printable: false
    referenceOnly: true
    openingDiameter: number
  }
  inputFrame: ConnectionFrame
}

function finite(value: number): boolean {
  return Number.isFinite(value)
}

function uniqueSorted(values: readonly number[]): number[] {
  return [...new Set(values.map((value) => Number(value).toFixed(6)))].map(Number).sort((left, right) => left - right)
}

function addTriangle(indices: number[], a: number, b: number, c: number): void {
  if (a !== b && b !== c && c !== a) indices.push(a, b, c)
}

function addNormal(normals: number[], positions: number[], a: number, b: number, c: number): void {
  const ax = positions[a * 3]
  const ay = positions[a * 3 + 1]
  const az = positions[a * 3 + 2]
  const abx = positions[b * 3] - ax
  const aby = positions[b * 3 + 1] - ay
  const abz = positions[b * 3 + 2] - az
  const acx = positions[c * 3] - ax
  const acy = positions[c * 3 + 1] - ay
  const acz = positions[c * 3 + 2] - az
  const nx = aby * acz - abz * acy
  const ny = abz * acx - abx * acz
  const nz = abx * acy - aby * acx
  for (const vertex of [a, b, c]) {
    normals[vertex * 3] += nx
    normals[vertex * 3 + 1] += ny
    normals[vertex * 3 + 2] += nz
  }
}

function meshFromArrays(positions: number[], indices: number[], label: string): MeshData {
  const typedPositions = new Float32Array(positions)
  const typedIndices = new Uint32Array(indices)
  const normalValues = new Array<number>(positions.length).fill(0)
  for (let index = 0; index < typedIndices.length; index += 3) {
    addNormal(normalValues, positions, typedIndices[index], typedIndices[index + 1], typedIndices[index + 2])
  }
  const normals = new Float32Array(positions.length)
  for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
    const offset = vertex * 3
    const length = Math.hypot(normalValues[offset], normalValues[offset + 1], normalValues[offset + 2])
    if (!Number.isFinite(length) || length === 0) throw new Error(`${label} contains a degenerate normal.`)
    normals[offset] = normalValues[offset] / length
    normals[offset + 1] = normalValues[offset + 1] / length
    normals[offset + 2] = normalValues[offset + 2] / length
  }
  const mesh = { positions: typedPositions, indices: typedIndices, normals }
  validateMeshData(mesh)
  return mesh
}

function mergeMeshes(meshes: readonly MeshData[]): MeshData {
  const positions = new Float32Array(meshes.reduce((total, mesh) => total + mesh.positions.length, 0))
  const indices = new Uint32Array(meshes.reduce((total, mesh) => total + mesh.indices.length, 0))
  const normals = meshes.every((mesh) => mesh.normals) ? new Float32Array(positions.length) : undefined
  let positionOffset = 0
  let vertexOffset = 0
  let indexOffset = 0
  for (const mesh of meshes) {
    positions.set(mesh.positions, positionOffset)
    if (normals && mesh.normals) normals.set(mesh.normals, positionOffset)
    for (let index = 0; index < mesh.indices.length; index += 1) {
      indices[indexOffset + index] = mesh.indices[index] + vertexOffset
    }
    positionOffset += mesh.positions.length
    vertexOffset += mesh.positions.length / 3
    indexOffset += mesh.indices.length
  }
  const merged = { positions, indices, ...(normals ? { normals } : {}) }
  validateMeshData(merged)
  return merged
}

function sectorMesh(
  innerRadius: number,
  outerRadius: number,
  bottomZ: number,
  topZ: number,
  segments: number,
  gapStart?: number,
  gapWidth = 0,
): MeshData {
  const positions: number[] = []
  const indices: number[] = []
  const inGap = (angle: number): boolean => {
    if (gapStart === undefined || gapWidth <= 0) return false
    let distance = Math.abs(angle - gapStart) % (Math.PI * 2)
    if (distance > Math.PI) distance = Math.PI * 2 - distance
    return distance <= gapWidth / 2
  }
  const addSector = (angle0: number, angle1: number) => {
    const cos0 = Math.cos(angle0)
    const sin0 = Math.sin(angle0)
    const cos1 = Math.cos(angle1)
    const sin1 = Math.sin(angle1)
    const base = positions.length / 3
    positions.push(
      cos0 * innerRadius, sin0 * innerRadius, bottomZ,
      cos0 * outerRadius, sin0 * outerRadius, bottomZ,
      cos1 * outerRadius, sin1 * outerRadius, bottomZ,
      cos1 * innerRadius, sin1 * innerRadius, bottomZ,
      cos0 * innerRadius, sin0 * innerRadius, topZ,
      cos0 * outerRadius, sin0 * outerRadius, topZ,
      cos1 * outerRadius, sin1 * outerRadius, topZ,
      cos1 * innerRadius, sin1 * innerRadius, topZ,
    )
    addTriangle(indices, base, base + 2, base + 1)
    addTriangle(indices, base, base + 3, base + 2)
    addTriangle(indices, base + 4, base + 5, base + 6)
    addTriangle(indices, base + 4, base + 6, base + 7)
    addTriangle(indices, base, base + 1, base + 5)
    addTriangle(indices, base, base + 5, base + 4)
    addTriangle(indices, base + 1, base + 2, base + 6)
    addTriangle(indices, base + 1, base + 6, base + 5)
    addTriangle(indices, base + 2, base + 3, base + 7)
    addTriangle(indices, base + 2, base + 7, base + 6)
    addTriangle(indices, base + 3, base, base + 4)
    addTriangle(indices, base + 3, base + 4, base + 7)
  }
  for (let column = 0; column < segments; column += 1) {
    const angle0 = Math.PI * 2 * column / segments
    const angle1 = Math.PI * 2 * (column + 1) / segments
    if (!inGap((angle0 + angle1) / 2)) addSector(angle0, angle1)
  }
  return meshFromArrays(positions, indices, 'Lamp annular geometry')
}

function polarPlinthMesh(
  geometry: LampBaseGeometry,
  parameters: LampBaseParameters,
  channelAngle: number,
): MeshData {
  const segments = Number(parameters.radialSegments)
  const outerRadius = geometry.outerRadius
  const channelStartRadius = geometry.pedestalInnerRadius
  const channelFloorZ = geometry.channelFloorZ
  const topZ = geometry.topZ
  const seatInnerRadius = geometry.seat.baseSeatInnerDiameter / 2
  const seatOuterRadius = geometry.seat.baseSeatOuterDiameter / 2
  const radii = uniqueSorted([channelStartRadius, geometry.pedestalOuterRadius, seatInnerRadius, seatOuterRadius, outerRadius])
    .filter((radius) => radius > 0 && radius <= outerRadius)
  const positions: number[] = [0, 0, 0, 0, 0, topZ]
  const bottomRings: number[][] = []
  const topRings: number[][] = []
  const channelWidthAngle = Math.min(Math.PI * 1.5, Math.max(0.05, Number(parameters.cableChannelWidth) / Math.max(channelStartRadius, 1)))
  const inChannel = (angle: number, radius: number): boolean => {
    if (radius < channelStartRadius - 1e-6) return false
    let distance = Math.abs(angle - channelAngle) % (Math.PI * 2)
    if (distance > Math.PI) distance = Math.PI * 2 - distance
    return distance <= channelWidthAngle / 2
  }
  const topAt = (radius: number, angle: number): number => {
    const inSeat = parameters.seatMode === 'recessed-seat'
      && radius >= seatInnerRadius - 1e-6
      && radius <= seatOuterRadius + 1e-6
    const seatFloor = inSeat ? geometry.seat.seatFloorZ : topZ
    return inChannel(angle, radius) ? Math.min(seatFloor, channelFloorZ) : seatFloor
  }
  for (const radius of radii) {
    const bottomRing: number[] = []
    const topRing: number[] = []
    for (let column = 0; column < segments; column += 1) {
      const angle = Math.PI * 2 * column / segments
      bottomRing.push(positions.length / 3)
      positions.push(Math.cos(angle) * radius, Math.sin(angle) * radius, 0)
      topRing.push(positions.length / 3)
      positions.push(Math.cos(angle) * radius, Math.sin(angle) * radius, topAt(radius, angle))
    }
    bottomRings.push(bottomRing)
    topRings.push(topRing)
  }

  const indices: number[] = []
  const firstBottom = bottomRings[0]
  const firstTop = topRings[0]
  for (let column = 0; column < segments; column += 1) {
    const next = (column + 1) % segments
    addTriangle(indices, 0, firstBottom[next], firstBottom[column])
    addTriangle(indices, 1, firstTop[column], firstTop[next])
  }
  for (let ring = 0; ring < radii.length - 1; ring += 1) {
    const bottom = bottomRings[ring]
    const bottomNext = bottomRings[ring + 1]
    const top = topRings[ring]
    const topNext = topRings[ring + 1]
    for (let column = 0; column < segments; column += 1) {
      const next = (column + 1) % segments
      addTriangle(indices, bottom[column], bottom[next], bottomNext[next])
      addTriangle(indices, bottom[column], bottomNext[next], bottomNext[column])
      addTriangle(indices, top[column], topNext[next], top[next])
      addTriangle(indices, top[column], topNext[column], topNext[next])
    }
  }
  const outerBottom = bottomRings[bottomRings.length - 1]
  const outerTop = topRings[topRings.length - 1]
  for (let column = 0; column < segments; column += 1) {
    const next = (column + 1) % segments
    addTriangle(indices, outerBottom[column], outerBottom[next], outerTop[next])
    addTriangle(indices, outerBottom[column], outerTop[next], outerTop[column])
  }

  const addWallAtAngle = (angle: number, fromRadius: number, toRadius: number, floorZ: number) => {
    const base = positions.length / 3
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    positions.push(
      cos * fromRadius, sin * fromRadius, floorZ,
      cos * toRadius, sin * toRadius, floorZ,
      cos * toRadius, sin * toRadius, topZ,
      cos * fromRadius, sin * fromRadius, topZ,
    )
    addTriangle(indices, base, base + 1, base + 2)
    addTriangle(indices, base, base + 2, base + 3)
  }
  const channelStartAngle = channelAngle - channelWidthAngle / 2
  const channelEndAngle = channelAngle + channelWidthAngle / 2
  addWallAtAngle(channelStartAngle, channelStartRadius, outerRadius, channelFloorZ)
  addWallAtAngle(channelEndAngle, channelStartRadius, outerRadius, channelFloorZ)
  return meshFromArrays(positions, indices, 'Wave Lamp plinth')
}

export function deriveWaveLampShadeSeat(parameters: ParameterValues): WaveLampShadeSeat {
  const bottomDiameter = Number(parameters.shadeSeatDiameter ?? parameters.bottomDiameter)
  const wallThickness = Number(parameters.wallThickness)
  const seatDiameter = bottomDiameter - wallThickness * 2
  const collarWallThickness = Math.max(0.8, wallThickness)
  const collarInnerDiameter = seatDiameter - collarWallThickness * 2
  return {
    seatDiameter,
    collarOuterDiameter: seatDiameter,
    collarInnerDiameter,
    collarWallThickness,
  }
}

export function deriveLampSeatGeometry(parameters: LampBaseParameters): LampSeatGeometry {
  const fitClearance = Number(parameters.fitClearance)
  const seat = parameters.shadeSeat
  const baseSeatInnerDiameter = seat.collarInnerDiameter - fitClearance * 2
  const baseSeatOuterDiameter = seat.collarOuterDiameter + fitClearance * 2
  const availableDepth = Number(parameters.baseThickness) - Number(parameters.bottomThickness)
  const seatDepth = Math.min(3, availableDepth * 0.65)
  const lipOuterDiameter = seat.collarInnerDiameter - fitClearance * 2
  const lipInnerDiameter = lipOuterDiameter - Math.max(1.5, seat.collarWallThickness)
  const lipHeight = Math.min(3, Math.max(0.75, availableDepth * 0.5))
  return {
    baseSeatInnerDiameter,
    baseSeatOuterDiameter,
    seatFloorZ: Number(parameters.baseThickness) - seatDepth,
    seatDepth,
    lipInnerDiameter,
    lipOuterDiameter,
    lipHeight,
  }
}

export function validateLampBaseParameters(parameters: LampBaseParameters): ValidationResult {
  const errors: string[] = []
  const values = [
    parameters.baseDiameter,
    parameters.baseThickness,
    parameters.bottomThickness,
    parameters.fitClearance,
    parameters.pedestalDiameter,
    parameters.pedestalHeight,
    parameters.holderOpeningDiameter,
    parameters.cableChannelWidth,
    parameters.cableChannelDepth,
    parameters.radialSegments,
    parameters.shadeSeat.seatDiameter,
    parameters.shadeSeat.collarOuterDiameter,
    parameters.shadeSeat.collarInnerDiameter,
  ].map(Number)
  if (values.some((value) => !finite(value))) errors.push('Wave Lamp base parameters must be finite numbers.')
  if (finite(Number(parameters.baseDiameter)) && Number(parameters.baseDiameter) <= 0) errors.push('Base diameter must be greater than zero.')
  if (finite(Number(parameters.baseThickness)) && Number(parameters.baseThickness) <= 0) errors.push('Base thickness must be greater than zero.')
  if (finite(Number(parameters.bottomThickness)) && Number(parameters.bottomThickness) <= 0) errors.push('Bottom thickness must be greater than zero.')
  if (finite(Number(parameters.baseThickness)) && finite(Number(parameters.bottomThickness))
    && Number(parameters.bottomThickness) >= Number(parameters.baseThickness)) errors.push('Bottom thickness must be less than base thickness.')
  if (parameters.seatMode !== 'recessed-seat' && parameters.seatMode !== 'raised-lip') errors.push('Wave Lamp seat mode is invalid.')
  if (finite(Number(parameters.fitClearance)) && Number(parameters.fitClearance) < 0) errors.push('Fit clearance cannot be negative.')
  if (finite(Number(parameters.pedestalDiameter)) && Number(parameters.pedestalDiameter) <= Number(parameters.holderOpeningDiameter)) {
    errors.push('Pedestal diameter must be greater than the holder opening diameter.')
  }
  if (finite(Number(parameters.cableChannelWidth)) && Number(parameters.cableChannelWidth) <= 0) errors.push('Cable channel width must be greater than zero.')
  if (finite(Number(parameters.cableChannelDepth)) && Number(parameters.cableChannelDepth) <= 0) errors.push('Cable channel depth must be greater than zero.')
  if (finite(Number(parameters.baseThickness)) && finite(Number(parameters.bottomThickness))
    && finite(Number(parameters.cableChannelDepth))
    && Number(parameters.cableChannelDepth) > Number(parameters.baseThickness) - Number(parameters.bottomThickness)) {
    errors.push('Cable channel depth must leave the specified bottom thickness.')
  }
  if (!Number.isInteger(Number(parameters.radialSegments)) || Number(parameters.radialSegments) < 16) errors.push('Base radial segments must be an integer of at least 16.')

  const seat = deriveLampSeatGeometry(parameters)
  if (!finite(seat.baseSeatInnerDiameter) || !finite(seat.baseSeatOuterDiameter) || seat.baseSeatInnerDiameter <= 0 || seat.baseSeatOuterDiameter <= seat.baseSeatInnerDiameter) {
    errors.push('Shade seat dimensions are invalid.')
  }
  if (finite(Number(parameters.baseDiameter)) && finite(seat.baseSeatOuterDiameter)
    && seat.baseSeatOuterDiameter >= Number(parameters.baseDiameter)) errors.push('Base outer wall must remain outside the shade seat.')
  if (parameters.seatMode === 'raised-lip' && (!finite(seat.lipInnerDiameter) || seat.lipInnerDiameter <= 0 || seat.lipOuterDiameter <= seat.lipInnerDiameter)) {
    errors.push('Raised lip dimensions are invalid.')
  }
  return { valid: errors.length === 0, errors }
}

export function generateLampBase(parameters: LampBaseParameters): LampBaseGeneration {
  const validation = validateLampBaseParameters(parameters)
  if (!validation.valid) throw new Error(validation.errors.join(' '))
  const seat = deriveLampSeatGeometry(parameters)
  const outerRadius = Number(parameters.baseDiameter) / 2
  const topZ = Number(parameters.baseThickness)
  const channelDepth = Number(parameters.cableChannelDepth)
  const geometry: LampBaseGeometry = {
    outerRadius,
    topZ,
    bottomThickness: Number(parameters.bottomThickness),
    channelFloorZ: topZ - channelDepth,
    pedestalOuterRadius: Number(parameters.pedestalDiameter) / 2,
    pedestalInnerRadius: Number(parameters.holderOpeningDiameter) / 2,
    pedestalTopZ: topZ + Number(parameters.pedestalHeight),
    seat,
  }
  const channelAngle = 0
  const plinth = polarPlinthMesh(geometry, parameters, channelAngle)
  const pedestal = sectorMesh(
    geometry.pedestalInnerRadius,
    geometry.pedestalOuterRadius,
    topZ,
    geometry.pedestalTopZ,
    Number(parameters.radialSegments),
    channelAngle,
    Math.min(Math.PI * 1.5, Math.max(0.05, Number(parameters.cableChannelWidth) / Math.max(geometry.pedestalInnerRadius, 1))),
  )
  const lip = parameters.seatMode === 'raised-lip'
    ? sectorMesh(seat.lipInnerDiameter / 2, seat.lipOuterDiameter / 2, topZ, topZ + seat.lipHeight, Number(parameters.radialSegments))
    : undefined
  const mesh = mergeMeshes([plinth, pedestal, ...(lip ? [lip] : [])])
  const shadeSeatZ = parameters.seatMode === 'recessed-seat' ? seat.seatFloorZ : topZ
  const inputFrame = createConnectionFrame(0, outerRadius)
  const shadeSeatFrame = createConnectionFrame(shadeSeatZ, parameters.shadeSeat.collarOuterDiameter / 2)
  const pedestalFrame = createConnectionFrame(geometry.pedestalTopZ, geometry.pedestalOuterRadius)
  const cableChannelFrame = createConnectionFrame(geometry.channelFloorZ, geometry.pedestalInnerRadius)
  const metadata: LampBaseMetadata = {
    kind: 'wave-lamp-base',
    printable: true,
    bottomThickness: geometry.bottomThickness,
    baseThickness: topZ,
    shadeSeat: parameters.shadeSeat,
    seat,
    pedestal: {
      outerDiameter: Number(parameters.pedestalDiameter),
      holderOpeningDiameter: Number(parameters.holderOpeningDiameter),
      topZ: geometry.pedestalTopZ,
    },
    cablePassage: {
      width: Number(parameters.cableChannelWidth),
      depth: channelDepth,
      floorZ: geometry.channelFloorZ,
      startRadius: geometry.pedestalInnerRadius,
      endRadius: outerRadius,
      isLocal: true,
      leavesStructure: true,
    },
  }
  const result = Object.assign(mesh, { lampBaseMetadata: metadata })
  return {
    ...result,
    mesh: result,
    geometry,
    metadata,
    inputFrame,
    outputFrame: shadeSeatFrame,
    shadeSeatFrame,
    pedestalFrame,
    cableChannelFrame,
  }
}

export function generateLampHolderReference(
  parameters: LampBaseParameters,
  inputFrame: ConnectionFrame,
): LampHolderReferenceGeneration {
  const outerRadius = Number(parameters.pedestalDiameter) * 0.42
  const innerRadius = Number(parameters.holderOpeningDiameter) / 2
  const height = Math.max(4, Math.min(12, Number(parameters.pedestalHeight) * 0.4))
  const mesh = sectorMesh(innerRadius, outerRadius, inputFrame.position.z, inputFrame.position.z + height, Number(parameters.radialSegments))
  const metadata = {
    kind: 'lamp-holder-reference' as const,
    printable: false as const,
    referenceOnly: true as const,
    openingDiameter: Number(parameters.holderOpeningDiameter),
  }
  const result = Object.assign(mesh, { lampHolderMetadata: metadata })
  return { ...result, mesh: result, metadata, inputFrame }
}

export const generateWaveLampBase = generateLampBase
export const deriveShadeSeat = deriveWaveLampShadeSeat
