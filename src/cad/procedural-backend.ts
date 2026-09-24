import { assembleComponents } from '../geometry/assembly'
import { deriveRimInterface, generateRimInterface } from '../geometry/rimInterface'
import { createWaveLampProfileRing, generateWaveLampMesh } from '../geometry/waveLamp'
import { createConnectionFrame, type GeometryBackend, type GeometryRequest, type MeshData } from '../geometry/types'
import { parametricWaveLamp, type WaveLampParameterValues } from '../generators/wave-lamp'

function numberValue(
  parameters: WaveLampParameterValues,
  id: string,
  aliases: readonly string[] = [],
  fallback = Number.NaN,
): number {
  const value = parameters[id] ?? aliases.map((alias) => parameters[alias]).find((candidate) => candidate !== undefined)
  const candidate = Number(value)
  return Number.isFinite(candidate) ? candidate : fallback
}

function composeWaveLamp(parameters: WaveLampParameterValues): MeshData {
  const bottomDiameter = numberValue(parameters, 'bottomDiameter', ['maxDiameter'])
  const wallThickness = numberValue(parameters, 'wallThickness')
  const rimClearance = numberValue(parameters, 'rimClearance', ['rimFitClearance'], 0.4)
  const rimDiameter = numberValue(
    parameters,
    'rimDiameter',
    [],
    bottomDiameter - 2 * (wallThickness + rimClearance),
  )
  const rim = deriveRimInterface({
    rimDiameter,
    rimHeight: numberValue(parameters, 'rimHeight'),
    rimThickness: numberValue(parameters, 'rimThickness'),
    rimLipDepth: numberValue(parameters, 'rimLipDepth'),
    rimClearance,
  })
  const rimGeneration = generateRimInterface(
    rim,
    createConnectionFrame(0, rim.rimOuterDiameter / 2),
    numberValue(parameters, 'radialSegments'),
  )
  const shadeStartFrame = rimGeneration.outputFrame
  const shadeMesh = generateWaveLampMesh(parameters, { shadeInputFrame: shadeStartFrame })

  const assembled = assembleComponents([
    {
      id: 'rim-interface',
      mesh: rimGeneration.mesh,
      inputFrame: rimGeneration.inputFrame,
      outputFrame: rimGeneration.outputFrame,
    },
    { id: 'decorative-shade', mesh: shadeMesh, inputFrame: shadeStartFrame },
  ])
  return {
    ...assembled,
    connectionFrames: [
      ...(assembled.connectionFrames ?? []),
      { id: 'decorative-shade:mounting-end', frame: shadeStartFrame },
      { id: 'rim-interface:shade-seat', frame: rimGeneration.outputFrame },
    ],
    profileRings: [
      { id: 'decorative-shade:mounting-profile', ring: createWaveLampProfileRing({ parameters, inputFrame: shadeStartFrame, normalizedHeight: 0 }) },
      { id: 'rim-interface:outer-profile', ring: rimGeneration.outerProfile },
    ],
  }
}

export const proceduralBackend: GeometryBackend = {
  id: 'procedural',
  async generate(request: GeometryRequest): Promise<MeshData> {
    if (request.operation !== 'wave-lamp') throw new Error(`Unsupported procedural operation: ${request.operation}`)
    const parameters = request.parameters as WaveLampParameterValues
    const validation = parametricWaveLamp.validate(parameters)
    if (!validation.valid) throw new Error(validation.errors.join(' '))
    return composeWaveLamp(parameters)
  },
}
