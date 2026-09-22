import type { ParameterDefinition, ParameterValues, ValidationResult } from '../parametric/types'
import { validateConnectionFrame } from './assembly'
import {
  FRAME_TOLERANCE,
  createConnectionFrame,
  validateMeshData,
  type ConnectionFrame,
  type MeshData,
  type ProfileRing,
} from './types'

export type TransitionType = 'straight' | 'linear-flare' | 'smooth'

export interface TransitionParameters extends ParameterValues {
  height: number
  startRadius: number
  endRadius: number
}

export interface TransitionProfile {
  type: TransitionType
  height: number
  startRadius: number
  endRadius: number
  inputFrame: ConnectionFrame
  outputFrame: ConnectionFrame
  radiusAt(height: number): number
}

export interface TransitionDefinition {
  id: TransitionType
  name: string
  category: string
  parameters: readonly ParameterDefinition[]
  validate(parameters: TransitionParameters): ValidationResult
  generate(parameters: TransitionParameters, inputFrame: ConnectionFrame): TransitionProfile
}

const transitionParameters: readonly ParameterDefinition[] = [
  {
    id: 'height',
    label: 'Height',
    description: 'Axial height of the transition.',
    type: 'number',
    unit: 'mm',
    min: 0,
    max: 200,
    step: 0.5,
  },
  {
    id: 'startRadius',
    label: 'Start radius',
    description: 'Radius at the mount side; zero uses the connected profile.',
    type: 'number',
    unit: 'mm',
    min: 0,
    max: 300,
    step: 0.5,
  },
  {
    id: 'endRadius',
    label: 'End radius',
    description: 'Radius at the shade side; zero uses the start profile.',
    type: 'number',
    unit: 'mm',
    min: 0,
    max: 300,
    step: 0.5,
  },
]

export function validateTransition(parameters: TransitionParameters): ValidationResult {
  const errors: string[] = []
  const height = Number(parameters.height)
  const startRadius = Number(parameters.startRadius)
  const endRadius = Number(parameters.endRadius)
  if (!Number.isFinite(height) || height < 0) errors.push('Transition height cannot be negative.')
  if (!Number.isFinite(startRadius) || startRadius < 0) errors.push('Transition start radius cannot be negative.')
  if (!Number.isFinite(endRadius) || endRadius < 0) errors.push('Transition end radius cannot be negative.')
  return { valid: errors.length === 0, errors }
}

function smootherStep(value: number): number {
  return value * value * value * (value * (value * 6 - 15) + 10)
}

function getInterpolation(type: TransitionType): (value: number) => number {
  if (type === 'smooth') return smootherStep
  if (type === 'linear-flare') return (value: number) => value
  return () => 0
}

function createTransitionProfile(
  type: TransitionType,
  parameters: TransitionParameters,
  inputFrame: ConnectionFrame,
): TransitionProfile {
  validateConnectionFrame(inputFrame, 'Transition input frame')
  const height = Number(parameters.height)
  const requestedStartRadius = Number(parameters.startRadius ?? 0)
  const startRadius = requestedStartRadius > 0 ? requestedStartRadius : inputFrame.radius
  const requestedEndRadius = Number(parameters.endRadius ?? 0)
  const endRadius = requestedEndRadius > 0 ? requestedEndRadius : startRadius
  if (requestedStartRadius > 0 && Math.abs(requestedStartRadius - inputFrame.radius) > FRAME_TOLERANCE) {
    throw new Error(
      `Transition start radius ${requestedStartRadius} does not match input frame radius ${inputFrame.radius}`
      + ` within tolerance ${FRAME_TOLERANCE}.`,
    )
  }
  const interpolation = getInterpolation(type)
  const radiusAt = (currentHeight: number): number => {
    if (height === 0) return endRadius
    const t = Math.min(1, Math.max(0, currentHeight / height))
    return startRadius + (endRadius - startRadius) * interpolation(t)
  }
  const outputFrame = createConnectionFrame(inputFrame.position.z + height, radiusAt(height))

  return {
    type,
    height,
    startRadius,
    endRadius,
    inputFrame,
    outputFrame,
    radiusAt,
  }
}

function createTransitionDefinition(type: TransitionType, name: string): TransitionDefinition {
  return {
    id: type,
    name,
    category: 'Transitions',
    parameters: transitionParameters,
    validate: validateTransition,
    generate(parameters, inputFrame) {
      const validation = validateTransition(parameters)
      if (!validation.valid) throw new Error(validation.errors.join(' '))
      return createTransitionProfile(type, parameters, inputFrame)
    },
  }
}

export const straightTransition = createTransitionDefinition('straight', 'Straight')
export const linearFlareTransition = createTransitionDefinition('linear-flare', 'Linear Flare')
export const smoothTransition = createTransitionDefinition('smooth', 'Smooth')

export const transitionDefinitions: readonly TransitionDefinition[] = [
  straightTransition,
  linearFlareTransition,
  smoothTransition,
]

export function getTransitionDefinition(type: string): TransitionDefinition {
  return transitionDefinitions.find((definition) => definition.id === type) ?? straightTransition
}

function addNormal(normals: Float32Array, positions: Float32Array, a: number, b: number, c: number): void {
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

export interface TransitionMeshOptions {
  outerTargetProfile?: ProfileRing
  innerTargetProfile?: ProfileRing
  radialSegments?: number
}

export function generateTransitionMesh(
  profile: TransitionProfile,
  innerStartRadius: number,
  innerEndRadius: number,
  options: TransitionMeshOptions = {},
): MeshData {
  if (profile.height <= 0) throw new Error('Transition mesh height must be greater than zero.')
  if (innerStartRadius < 0 || innerEndRadius < 0) throw new Error('Transition inner radii cannot be negative.')
  const endRadius = profile.radiusAt(profile.height)
  if (profile.startRadius <= innerStartRadius || endRadius <= innerEndRadius) {
    throw new Error('Transition wall thickness must remain positive.')
  }

  const segments = options.radialSegments ?? options.outerTargetProfile?.points.length ?? 64
  if (options.outerTargetProfile && options.outerTargetProfile.points.length !== segments) {
    throw new Error('Transition target profile must use the same radial segment count.')
  }
  if (options.innerTargetProfile && options.innerTargetProfile.points.length !== segments) {
    throw new Error('Transition inner target profile must use the same radial segment count.')
  }
  const rows = 16
  const positions = new Float32Array(segments * (rows + 1) * 2 * 3)
  const indices: number[] = []
  const ring = (row: number, inner: boolean, column: number) =>
    (row * 2 + (inner ? 1 : 0)) * segments + (column % segments + segments) % segments
  for (let row = 0; row <= rows; row += 1) {
    const t = row / rows
    const blend = getInterpolation(profile.type)(t)
    const outerRadius = profile.radiusAt(profile.height * t)
    const innerRadius = innerStartRadius + (innerEndRadius - innerStartRadius) * blend
    for (let column = 0; column < segments; column += 1) {
      const baseAngle = (Math.PI * 2 * column) / segments
      const targetOuter = options.outerTargetProfile?.points[column]
      const targetInner = options.innerTargetProfile?.points[column]
      const angle = row === rows && targetOuter ? targetOuter.angle : baseAngle + ((targetOuter?.angle ?? baseAngle) - baseAngle) * blend
      const innerAngle = row === rows && targetInner ? targetInner.angle : baseAngle + ((targetInner?.angle ?? baseAngle) - baseAngle) * blend
      const blendedOuterRadius = row === rows && targetOuter ? targetOuter.radius : outerRadius + ((targetOuter?.radius ?? outerRadius) - outerRadius) * blend
      const blendedInnerRadius = row === rows && targetInner ? targetInner.radius : innerRadius + ((targetInner?.radius ?? innerRadius) - innerRadius) * blend
      const outer = ring(row, false, column)
      const inner = ring(row, true, column)
      positions[outer * 3] = Math.cos(angle) * blendedOuterRadius
      positions[outer * 3 + 1] = Math.sin(angle) * blendedOuterRadius
      positions[outer * 3 + 2] = profile.inputFrame.position.z + profile.height * t
      positions[inner * 3] = Math.cos(innerAngle) * blendedInnerRadius
      positions[inner * 3 + 1] = Math.sin(innerAngle) * blendedInnerRadius
      positions[inner * 3 + 2] = profile.inputFrame.position.z + profile.height * t
    }
  }
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < segments; column += 1) {
      const next = column + 1
      indices.push(ring(row, false, column), ring(row + 1, false, column), ring(row + 1, false, next))
      indices.push(ring(row, false, column), ring(row + 1, false, next), ring(row, false, next))
      indices.push(ring(row, true, column), ring(row, true, next), ring(row + 1, true, next))
      indices.push(ring(row, true, column), ring(row + 1, true, next), ring(row + 1, true, column))
    }
  }
  for (let column = 0; column < segments; column += 1) {
    const next = column + 1
    indices.push(ring(0, false, column), ring(0, true, column), ring(0, true, next))
    indices.push(ring(0, false, column), ring(0, true, next), ring(0, false, next))
    if (!options.outerTargetProfile) {
      indices.push(ring(rows, false, column), ring(rows, false, next), ring(rows, true, next))
      indices.push(ring(rows, false, column), ring(rows, true, next), ring(rows, true, column))
    }
  }

  const typedIndices = new Uint32Array(indices)
  const normals = new Float32Array(positions.length)
  for (let index = 0; index < typedIndices.length; index += 3) {
    addNormal(normals, positions, typedIndices[index], typedIndices[index + 1], typedIndices[index + 2])
  }
  for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
    const offset = vertex * 3
    const length = Math.hypot(normals[offset], normals[offset + 1], normals[offset + 2])
    if (!Number.isFinite(length) || length === 0) throw new Error('Generated transition contains a degenerate normal.')
    normals[offset] /= length
    normals[offset + 1] /= length
    normals[offset + 2] /= length
  }
  const mesh = { positions, indices: typedIndices, normals }
  validateMeshData(mesh)
  return mesh
}
