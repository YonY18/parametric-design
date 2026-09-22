import {
  FRAME_TOLERANCE,
  type ConnectionFrame,
  type MeshData,
  validateMeshData,
} from './types'

export interface AssemblyComponent {
  id: string
  mesh: MeshData
  inputFrame?: ConnectionFrame
  outputFrame?: ConnectionFrame
}

function finite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`)
}

function closeEnough(left: number, right: number): boolean {
  return Math.abs(left - right) <= FRAME_TOLERANCE
}

function validateVector(vector: ConnectionFrame['position'], label: string): void {
  finite(vector.x, `${label}.x`)
  finite(vector.y, `${label}.y`)
  finite(vector.z, `${label}.z`)
}

export function validateConnectionFrame(frame: ConnectionFrame, label = 'Connection frame'): void {
  validateVector(frame.position, `${label} position`)
  validateVector(frame.axis, `${label} axis`)
  finite(frame.radius, `${label} radius`)
  if (!closeEnough(frame.position.x, 0) || !closeEnough(frame.position.y, 0)) {
    throw new Error(`${label} must be centered on X=0/Y=0; received (${frame.position.x}, ${frame.position.y}).`)
  }
  if (!closeEnough(frame.axis.x, 0) || !closeEnough(frame.axis.y, 0) || !closeEnough(frame.axis.z, 1)) {
    throw new Error(`${label} must use the +Z axis; received (${frame.axis.x}, ${frame.axis.y}, ${frame.axis.z}).`)
  }
  if (frame.radius <= 0) throw new Error(`${label} radius must be greater than zero.`)
}

function assertFramesAligned(
  outputFrame: ConnectionFrame,
  inputFrame: ConnectionFrame,
  outputLabel: string,
  inputLabel: string,
): void {
  if (!closeEnough(outputFrame.position.x, inputFrame.position.x)
    || !closeEnough(outputFrame.position.y, inputFrame.position.y)
    || !closeEnough(outputFrame.position.z, inputFrame.position.z)) {
    throw new Error(
      `${outputLabel} does not align with ${inputLabel}: positions differ `
      + `(${outputFrame.position.x}, ${outputFrame.position.y}, ${outputFrame.position.z}) vs `
      + `(${inputFrame.position.x}, ${inputFrame.position.y}, ${inputFrame.position.z}).`,
    )
  }
  if (!closeEnough(outputFrame.axis.x, inputFrame.axis.x)
    || !closeEnough(outputFrame.axis.y, inputFrame.axis.y)
    || !closeEnough(outputFrame.axis.z, inputFrame.axis.z)) {
    throw new Error(`${outputLabel} does not align with ${inputLabel}: axes differ.`)
  }
  if (!closeEnough(outputFrame.radius, inputFrame.radius)) {
    throw new Error(
      `${outputLabel} radius ${outputFrame.radius} does not match ${inputLabel} radius ${inputFrame.radius}`
      + ` within tolerance ${FRAME_TOLERANCE}.`,
    )
  }
}

function mergeMeshes(components: readonly AssemblyComponent[]): MeshData {
  const positionLength = components.reduce((total, component) => total + component.mesh.positions.length, 0)
  const indexLength = components.reduce((total, component) => total + component.mesh.indices.length, 0)
  const positions = new Float32Array(positionLength)
  const indices = new Uint32Array(indexLength)
  const hasNormals = components.every(({ mesh }) => mesh.normals)
  const normals = hasNormals ? new Float32Array(positionLength) : undefined
  let positionOffset = 0
  let vertexOffset = 0
  let indexOffset = 0

  for (const component of components) {
    const { mesh } = component
    positions.set(mesh.positions, positionOffset)
    if (normals && mesh.normals) normals.set(mesh.normals, positionOffset)
    for (let index = 0; index < mesh.indices.length; index += 1) {
      indices[indexOffset + index] = mesh.indices[index] + vertexOffset
    }
    positionOffset += mesh.positions.length
    vertexOffset += mesh.positions.length / 3
    indexOffset += mesh.indices.length
  }

  const parts = components.map(({ id, mesh, inputFrame, outputFrame }) => ({
    id,
    mesh,
    inputFrame,
    outputFrame,
  }))
  const connectionFrames = components.flatMap(({ id, inputFrame, outputFrame }) => [
    ...(inputFrame ? [{ id: `${id}:input`, frame: inputFrame }] : []),
    ...(outputFrame ? [{ id: `${id}:output`, frame: outputFrame }] : []),
  ])
  const merged: MeshData = { positions, indices, ...(normals ? { normals } : {}), parts, connectionFrames }
  validateMeshData(merged)
  return merged
}

export function assembleComponents(components: readonly AssemblyComponent[]): MeshData {
  if (components.length === 0) throw new Error('Assembly requires at least one component.')

  for (const component of components) {
    if (!component.id) throw new Error('Assembly components require a non-empty id.')
    validateMeshData(component.mesh)
    if (component.inputFrame) validateConnectionFrame(component.inputFrame, `${component.id} input frame`)
    if (component.outputFrame) validateConnectionFrame(component.outputFrame, `${component.id} output frame`)
  }

  for (let index = 1; index < components.length; index += 1) {
    const previous = components[index - 1]
    const current = components[index]
    if (!previous.outputFrame || !current.inputFrame) {
      throw new Error(`Assembly connection between ${previous.id} and ${current.id} requires both output and input frames.`)
    }
    assertFramesAligned(
      previous.outputFrame,
      current.inputFrame,
      `${previous.id} output frame`,
      `${current.id} input frame`,
    )
  }

  return mergeMeshes(components)
}
