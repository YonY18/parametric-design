import { generateInternalShadeSupport } from '../geometry/internalShadeSupport'
import type { AssemblyComponent } from '../geometry/assembly'
import { deriveMechanicalCore } from '../geometry/mechanicalCore'
import { retainingRingDefinition } from '../geometry/retainingRing'
import { generateThreadedHub } from '../geometry/threadedHub'
import { createWaveLampProfileRing, generateWaveLampMesh } from '../geometry/waveLamp'
import {
  createConnectionFrame,
  validateMeshData,
  type ConnectionFrame,
  type GeometryBackend,
  type GeometryRequest,
  type MeshData,
  type MeshPart,
} from '../geometry/types'
import { parametricWaveLamp, type WaveLampParameterValues } from '../generators/wave-lamp'

function number(parameters: WaveLampParameterValues, id: keyof WaveLampParameterValues): number {
  const value = Number(parameters[id])
  if (!Number.isFinite(value)) throw new Error(`Parameter "${String(id)}" must be a finite number.`)
  return value
}

function assembleComponents(components: readonly AssemblyComponent[]): MeshData {
  const positionLength = components.reduce((total, component) => total + component.mesh.positions.length, 0)
  const indexLength = components.reduce((total, component) => total + component.mesh.indices.length, 0)
  const positions = new Float32Array(positionLength)
  const indices = new Uint32Array(indexLength)
  const hasNormals = components.every(({ mesh }) => mesh.normals)
  const normals = hasNormals ? new Float32Array(positionLength) : undefined
  const parts: MeshPart[] = []
  const connectionFrames: { id: string; frame: ConnectionFrame }[] = []
  let positionOffset = 0
  let vertexOffset = 0
  let indexOffset = 0

  for (const component of components) {
    validateMeshData(component.mesh)
    positions.set(component.mesh.positions, positionOffset)
    if (normals && component.mesh.normals) normals.set(component.mesh.normals, positionOffset)
    for (let index = 0; index < component.mesh.indices.length; index += 1) {
      indices[indexOffset + index] = component.mesh.indices[index] + vertexOffset
    }
    parts.push({
      id: component.id,
      mesh: component.mesh,
      inputFrame: component.inputFrame,
      outputFrame: component.outputFrame,
    })
    if (component.inputFrame) connectionFrames.push({ id: `${component.id}:input`, frame: component.inputFrame })
    if (component.outputFrame) connectionFrames.push({ id: `${component.id}:output`, frame: component.outputFrame })
    positionOffset += component.mesh.positions.length
    vertexOffset += component.mesh.positions.length / 3
    indexOffset += component.mesh.indices.length
  }

  const assembled: MeshData = {
    positions,
    indices,
    ...(normals ? { normals } : {}),
    parts,
    connectionFrames,
  }
  validateMeshData(assembled)
  return assembled
}

function composeMountedWaveLamp(parameters: WaveLampParameterValues): MeshData {
  const core = deriveMechanicalCore({
    mountType: 'threaded',
    nominalThreadDiameter: number(parameters, 'nominalThreadDiameter'),
    threadPitch: number(parameters, 'threadPitch'),
    threadClearance: number(parameters, 'threadClearance'),
    cableHoleDiameter: number(parameters, 'cableHoleDiameter'),
    supportInset: number(parameters, 'supportInset'),
    supportThickness: number(parameters, 'supportThickness'),
    wallThickness: number(parameters, 'wallThickness'),
    height: number(parameters, 'height'),
    radialSegments: number(parameters, 'radialSegments'),
    maxDiameter: number(parameters, 'maxDiameter'),
  })

  const shadeStartFrame = createConnectionFrame(0, number(parameters, 'maxDiameter') / 2)
  const shadeMesh = generateWaveLampMesh(parameters, { shadeInputFrame: shadeStartFrame })
  const supportProfile = createWaveLampProfileRing({
    parameters,
    inputFrame: shadeStartFrame,
    normalizedHeight: number(parameters, 'supportInset') / number(parameters, 'height'),
  })
  const support = generateInternalShadeSupport(core.support, supportProfile, shadeStartFrame.position.z)
  const hub = generateThreadedHub(
    core.hub,
    createConnectionFrame(shadeStartFrame.position.z, core.dimensions.hubOuterDiameter / 2),
  )
  const ring = retainingRingDefinition.generate(
    core.ring,
    createConnectionFrame(shadeStartFrame.position.z, core.dimensions.ringOuterDiameter / 2),
  )

  const assembled = assembleComponents([
    { id: 'decorative-shade', mesh: shadeMesh, inputFrame: shadeStartFrame },
    {
      id: 'internal-support',
      mesh: support.mesh,
      inputFrame: support.inputFrame,
      outputFrame: support.outputFrame,
    },
    { id: 'threaded-hub', mesh: hub.mesh, inputFrame: hub.inputFrame, outputFrame: hub.outputFrame },
    { id: 'retaining-ring', mesh: ring.mesh, inputFrame: ring.inputFrame, outputFrame: ring.outputFrame },
  ])

  return {
    ...assembled,
    connectionFrames: [
      ...(assembled.connectionFrames ?? []),
      { id: 'decorative-shade:mounting-end', frame: shadeStartFrame },
      { id: 'internal-support:plate-plane', frame: support.inputFrame },
      { id: 'threaded-hub:attachment-interface', frame: hub.inputFrame },
      { id: 'retaining-ring:pressure-face', frame: ring.pressureFaceFrame },
    ],
    profileRings: [
      { id: 'decorative-shade:support-interior-profile', ring: support.outerProfile },
      {
        id: 'decorative-shade:mounting-profile',
        ring: createWaveLampProfileRing({
          parameters,
          inputFrame: shadeStartFrame,
          normalizedHeight: 0,
        }),
      },
    ],
  }
}

function composeWaveLamp(parameters: WaveLampParameterValues): MeshData {
  if (parameters.mountType === 'threaded') return composeMountedWaveLamp(parameters)
  return generateWaveLampMesh(parameters)
}

export const proceduralBackend: GeometryBackend = {
  id: 'procedural',
  async generate(request: GeometryRequest): Promise<MeshData> {
    if (request.operation !== 'wave-lamp') {
      throw new Error(`Unsupported procedural operation: ${request.operation}`)
    }
    const parameters = request.parameters as WaveLampParameterValues
    const validation = parametricWaveLamp.validate(parameters)
    if (!validation.valid) throw new Error(validation.errors.join(' '))
    return composeWaveLamp(parameters)
  },
}
