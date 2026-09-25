import { validateMeshData, type ConnectionFrame, type GeometryBackend, type GeometryRequest, type MeshData } from '../geometry/types'
import { generateLampBase, generateLampHolderReference } from '../geometry/lampBase'
import { createWaveLampProfileRing, generateWaveLampMesh } from '../geometry/waveLamp'
import { parametricBaseTest, generateBaseTest, type BaseTestParameterValues } from '../generators/base-test'
import {
  parametricWaveLamp,
  waveLampBaseParameters,
  waveLampDecorativeParameters,
  type WaveLampParameterValues,
} from '../generators/wave-lamp'

interface IndependentComponent {
  id: string
  mesh: MeshData
  inputFrame?: ConnectionFrame
  outputFrame?: ConnectionFrame
}

function mergeIndependentComponents(components: readonly IndependentComponent[]): MeshData {
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
    positions.set(component.mesh.positions, positionOffset)
    if (normals && component.mesh.normals) normals.set(component.mesh.normals, positionOffset)
    for (let index = 0; index < component.mesh.indices.length; index += 1) {
      indices[indexOffset + index] = component.mesh.indices[index] + vertexOffset
    }
    positionOffset += component.mesh.positions.length
    vertexOffset += component.mesh.positions.length / 3
    indexOffset += component.mesh.indices.length
  }

  const parts = components.map(({ id, mesh, inputFrame, outputFrame }) => ({ id, mesh, inputFrame, outputFrame }))
  const connectionFrames = components.flatMap(({ id, inputFrame, outputFrame }) => [
    ...(inputFrame ? [{ id: `${id}:input`, frame: inputFrame }] : []),
    ...(outputFrame ? [{ id: `${id}:output`, frame: outputFrame }] : []),
  ])
  const merged: MeshData = { positions, indices, ...(normals ? { normals } : {}), parts, connectionFrames }
  validateMeshData(merged)
  return merged
}

function composeWaveLamp(parameters: WaveLampParameterValues): MeshData {
  const baseParameters = waveLampBaseParameters(parameters)
  const baseGeneration = generateLampBase(baseParameters)
  const shadeStartFrame = baseGeneration.shadeSeatFrame
  const decorativeParameters = waveLampDecorativeParameters(parameters)
  const shadeMesh = generateWaveLampMesh(decorativeParameters, {
    shadeInputFrame: shadeStartFrame,
    shadeSeat: baseParameters.shadeSeat,
    adaptationHeight: Number(parameters.bottomAdaptationHeight),
  })
  const holderGeneration = generateLampHolderReference(baseParameters, baseGeneration.pedestalFrame)

  const assembled = mergeIndependentComponents([
    {
      id: 'base',
      mesh: baseGeneration.mesh,
      inputFrame: baseGeneration.inputFrame,
      outputFrame: baseGeneration.outputFrame,
    },
    {
      id: 'decorative-shade',
      mesh: shadeMesh,
      inputFrame: shadeStartFrame,
    },
    {
      id: 'lamp-holder-reference',
      mesh: holderGeneration.mesh,
      inputFrame: holderGeneration.inputFrame,
    },
  ])
  return {
    ...assembled,
    connectionFrames: [
      ...(assembled.connectionFrames ?? []),
      { id: 'base:peripheral-seat', frame: baseGeneration.shadeSeatFrame },
      { id: 'decorative-shade:peripheral-collar', frame: shadeStartFrame },
      { id: 'base:central-pedestal', frame: baseGeneration.pedestalFrame },
      { id: 'lamp-holder-reference:central-opening', frame: baseGeneration.pedestalFrame },
    ],
    profileRings: [
      {
        id: 'decorative-shade:bottom-collar',
        ring: createWaveLampProfileRing({
          parameters: decorativeParameters,
          inputFrame: shadeStartFrame,
          normalizedHeight: 0,
          shadeSeat: baseParameters.shadeSeat,
          adaptationHeight: Number(parameters.bottomAdaptationHeight),
        }),
      },
    ],
  }
}

export const proceduralBackend: GeometryBackend = {
  id: 'procedural',
  async generate(request: GeometryRequest): Promise<MeshData> {
    if (request.operation === 'base-test') {
      const parameters = request.parameters as BaseTestParameterValues
      const validation = parametricBaseTest.validate(parameters)
      if (!validation.valid) throw new Error(validation.errors.join(' '))
      return generateBaseTest(parameters)
    }
    if (request.operation !== 'wave-lamp') throw new Error(`Unsupported procedural operation: ${request.operation}`)
    const parameters = request.parameters as WaveLampParameterValues
    const validation = parametricWaveLamp.validate(parameters)
    if (!validation.valid) throw new Error(validation.errors.join(' '))
    return composeWaveLamp(parameters)
  },
}
