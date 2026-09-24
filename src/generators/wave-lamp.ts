import type { GeometryRequest } from '../geometry/types'
import type {
  NumberParameterDefinition,
  ParameterDefinition,
  ParameterGroup,
  ParameterSection,
  ParameterValues,
  ParametricModelDefinition,
  ValidationResult,
} from '../parametric/types'

export type WaveLampParameterValues = ParameterValues & {
  height: number
  bottomDiameter: number
  topDiameter: number
  wallThickness: number
  waves: number
  amplitude: number
  twist: number
  rimDiameter: number
  rimHeight: number
  rimThickness: number
  rimLipDepth: number
  rimClearance: number
  verticalSegments: number
  radialSegments: number
  // Accepted for saved models created before the reduced contract.
  patternCount?: number
  patternAmplitude?: number
  waveAmplitude?: number
  twistAngle?: number
  rimFitClearance?: number
}

const numberParameter = (
  id: string,
  label: string,
  description: string,
  min: number,
  max: number,
  step: number,
  unit = 'mm',
  integer = false,
): NumberParameterDefinition => ({
  id,
  label,
  description,
  type: 'number',
  unit,
  min,
  max,
  step,
  ...(integer ? { integer: true } : {}),
})

const shadeParameters: readonly ParameterDefinition[] = [
  numberParameter('height', 'Height', 'Overall height of the decorative shade.', 50, 500, 1),
  numberParameter('bottomDiameter', 'Bottom diameter', 'Body diameter at the lower end of the shade.', 40, 400, 1),
  numberParameter('topDiameter', 'Top diameter', 'Outside diameter at the upper end of the shade.', 40, 400, 1),
  numberParameter('wallThickness', 'Wall thickness', 'Radial material thickness of the shade.', 0.4, 10, 0.1),
  numberParameter('waves', 'Waves', 'Number of radial decorative waves.', 3, 64, 1, 'count', true),
  numberParameter('amplitude', 'Amplitude', 'Radial wave amplitude as a percentage of the local radius.', 0, 40, 0.5, '%'),
  numberParameter('twist', 'Twist', 'Progressive twist from the mounting end to the top.', -360, 360, 1, 'deg'),
]

const rimParameters: readonly ParameterDefinition[] = [
  numberParameter('rimDiameter', 'Diameter', 'Outer diameter of the independent circular rim interface.', 40, 400, 1),
  numberParameter('rimHeight', 'Height', 'Axial height of the circular rim interface.', 0.5, 40, 0.1),
  numberParameter('rimThickness', 'Thickness', 'Radial wall thickness of the rim interface.', 0.4, 20, 0.1),
  numberParameter('rimLipDepth', 'Lip depth', 'Radial depth of the circular retaining lip.', 0, 20, 0.1),
  numberParameter('rimClearance', 'Clearance', 'Fit clearance retained by the independent rim interface.', 0, 4, 0.05),
]

const resolutionParameters: readonly NumberParameterDefinition[] = [
  numberParameter('verticalSegments', 'Vertical segments', 'Mesh resolution along the shade height.', 20, 300, 1, 'segments', true),
  numberParameter('radialSegments', 'Radial segments', 'Mesh resolution around the circumference.', 32, 512, 1, 'segments', true),
]

const waveLampParameters: readonly ParameterDefinition[] = [
  ...shadeParameters,
  ...rimParameters,
  ...resolutionParameters,
]

const waveLampParameterSchema: readonly ParameterSection[] = [
  {
    id: 'decorative-shade',
    label: 'Decorative Shade',
    description: 'The shade is an independent decorative body with a circular mounting end.',
    groups: [
      { id: 'shade', label: 'Shade', parameters: shadeParameters },
      { id: 'resolution', label: 'Resolution', parameters: resolutionParameters },
    ] satisfies readonly ParameterGroup[],
  },
  {
    id: 'rim-interface',
    label: 'Rim Interface',
    description: 'A fully circular interface independent from all shade deformers.',
    parameters: rimParameters,
  },
]

const waveLampDefaults: WaveLampParameterValues = {
  height: 180,
  bottomDiameter: 120,
  topDiameter: 100,
  wallThickness: 1.2,
  waves: 8,
  amplitude: 5,
  twist: 35,
  rimDiameter: 116.8,
  rimHeight: 6,
  rimThickness: 2,
  rimLipDepth: 1,
  rimClearance: 0.4,
  verticalSegments: 100,
  radialSegments: 128,
}

const createWaveLampRequest = (parameters: WaveLampParameterValues): GeometryRequest => ({
  backend: 'procedural',
  operation: 'wave-lamp',
  parameters,
})

function value(parameters: ParameterValues, id: string, aliases: readonly string[] = []): ParameterValue | undefined {
  return parameters[id] ?? aliases.map((alias) => parameters[alias]).find((candidate) => candidate !== undefined)
}

type ParameterValue = ParameterValues[string]

function numberValue(
  parameters: ParameterValues,
  id: string,
  aliases: readonly string[] = [],
  fallback = Number.NaN,
): number {
  const candidate = Number(value(parameters, id, aliases))
  return Number.isFinite(candidate) ? candidate : fallback
}

function validateWaveLamp(parameters: WaveLampParameterValues): ValidationResult {
  const errors: string[] = []
  const height = numberValue(parameters, 'height')
  const bottomDiameter = numberValue(parameters, 'bottomDiameter', ['maxDiameter'])
  const topDiameter = numberValue(parameters, 'topDiameter')
  const wallThickness = numberValue(parameters, 'wallThickness')
  const waves = numberValue(parameters, 'waves', ['patternCount'])
  const amplitude = numberValue(parameters, 'amplitude', ['patternAmplitude', 'waveAmplitude'])
  const twist = numberValue(parameters, 'twist', ['twistAngle'])
  const rimHeight = numberValue(parameters, 'rimHeight')
  const rimThickness = numberValue(parameters, 'rimThickness')
  const rimLipDepth = numberValue(parameters, 'rimLipDepth')
  const rimClearance = numberValue(parameters, 'rimClearance', ['rimFitClearance'], 0.4)
  const requestedRimDiameter = numberValue(parameters, 'rimDiameter')
  const rimDiameter = Number.isFinite(requestedRimDiameter)
    ? requestedRimDiameter
    : bottomDiameter - 2 * (wallThickness + rimClearance)
  const verticalSegments = numberValue(parameters, 'verticalSegments')
  const radialSegments = numberValue(parameters, 'radialSegments')

  if (!Number.isFinite(height) || height < 50 || height > 500) errors.push('Height must be between 50 and 500 mm.')
  if (!Number.isFinite(bottomDiameter) || bottomDiameter < 40 || bottomDiameter > 400) errors.push('Bottom diameter must be between 40 and 400 mm.')
  if (!Number.isFinite(topDiameter) || topDiameter < 40 || topDiameter > 400) errors.push('Top diameter must be between 40 and 400 mm.')
  if (!Number.isFinite(wallThickness) || wallThickness < 0.4 || wallThickness > 10) errors.push('Wall thickness must be between 0.4 and 10 mm.')
  if (!Number.isInteger(waves) || waves < 3 || waves > 64) errors.push('Waves must be an integer between 3 and 64.')
  if (!Number.isFinite(amplitude) || amplitude < 0 || amplitude > 40) errors.push('Amplitude must be between 0 and 40 percent.')
  if (!Number.isFinite(twist) || twist < -360 || twist > 360) errors.push('Twist must be between -360 and 360 degrees.')
  if (!Number.isFinite(rimDiameter) || rimDiameter < 40 || rimDiameter > 400) errors.push('Rim diameter must be between 40 and 400 mm.')
  if (!Number.isFinite(rimHeight) || rimHeight < 0.5 || rimHeight > 40) errors.push('Rim height must be between 0.5 and 40 mm.')
  if (!Number.isFinite(rimThickness) || rimThickness < 0.4 || rimThickness > 20) errors.push('Rim thickness must be between 0.4 and 20 mm.')
  if (!Number.isFinite(rimLipDepth) || rimLipDepth < 0 || rimLipDepth > 20) errors.push('Rim lip depth must be between 0 and 20 mm.')
  if (!Number.isFinite(rimClearance) || rimClearance < 0 || rimClearance > 4) errors.push('Rim clearance must be between 0 and 4 mm.')
  if (!Number.isInteger(verticalSegments) || verticalSegments < 20 || verticalSegments > 300) errors.push('Vertical segments must be an integer between 20 and 300.')
  if (!Number.isInteger(radialSegments) || radialSegments < 32 || radialSegments > 512) errors.push('Radial segments must be an integer between 32 and 512.')

  const rimInnerDiameter = rimDiameter - 2 * rimThickness
  if (Number.isFinite(rimInnerDiameter) && rimInnerDiameter <= 0) errors.push('Rim dimensions leave no inner opening.')
  if (Number.isFinite(rimInnerDiameter) && Number.isFinite(rimLipDepth) && rimLipDepth >= rimInnerDiameter / 2) errors.push('Rim lip depth must leave a positive inner opening.')
  if (Number.isFinite(bottomDiameter) && bottomDiameter <= wallThickness * 2) errors.push('Bottom diameter must be greater than twice the wall thickness.')
  if (Number.isFinite(topDiameter) && topDiameter <= wallThickness * 2) errors.push('Top diameter must be greater than twice the wall thickness.')

  if (Number.isFinite(bottomDiameter) && Number.isFinite(topDiameter) && Number.isFinite(amplitude)) {
    const minimumBodyRadius = Math.min(bottomDiameter, topDiameter) / 2
    const minimumDecorativeRadius = minimumBodyRadius * (1 - amplitude / 100)
    if (minimumDecorativeRadius <= wallThickness) errors.push('Amplitude is too large for the current wall thickness.')
  }
  if (Number.isFinite(rimDiameter) && Number.isFinite(wallThickness) && rimDiameter <= wallThickness * 2) {
    errors.push('Rim diameter must be greater than twice the wall thickness.')
  }

  return { valid: errors.length === 0, errors }
}

function quantize(valueToQuantize: number, step: number, min: number, max: number): number {
  const clamped = Math.min(max, Math.max(min, valueToQuantize))
  return Math.round((clamped - min) / step) * step + min
}

function randomizeWaveLamp(parameters: WaveLampParameterValues, random = Math.random): WaveLampParameterValues {
  return {
    ...parameters,
    height: Math.round(140 + random() * 180),
    bottomDiameter: Math.round(90 + random() * 150),
    topDiameter: Math.round(80 + random() * 140),
    waves: Math.round(6 + random() * 18),
    amplitude: quantize(2 + random() * 7, 0.5, 0, 40),
    twist: Math.round(-90 + random() * 180),
  }
}

export const parametricWaveLamp: ParametricModelDefinition<WaveLampParameterValues> = {
  id: 'wave-lamp',
  name: 'Wave Lamp',
  category: 'Lamps',
  description: 'A closed, hollow lampshade with a twisted radial wave profile and independent circular rim.',
  metadata: {
    name: 'Wave Lamp',
    category: 'Lamps',
    description: 'A closed, hollow lampshade with a twisted radial wave profile and independent circular rim.',
  },
  parameters: waveLampParameters,
  parameterSchema: waveLampParameterSchema,
  defaults: waveLampDefaults,
  generation: {
    backend: 'procedural',
    operation: 'wave-lamp',
    generate: createWaveLampRequest,
  },
  validate: validateWaveLamp,
  generate: createWaveLampRequest,
  reset: () => ({ ...waveLampDefaults }),
  randomize: randomizeWaveLamp,
}
