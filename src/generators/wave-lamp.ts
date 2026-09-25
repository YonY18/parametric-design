import type { GeometryRequest } from '../geometry/types'
import {
  deriveWaveLampShadeSeat,
  validateLampBaseParameters,
  type LampBaseParameters,
  type WaveLampSeatMode,
} from '../geometry/lampBase'
import type {
  NumberParameterDefinition,
  ParameterDefinition,
  ParameterGroup,
  ParameterSection,
  ParameterValues,
  ParametricModelDefinition,
  SelectParameterDefinition,
  ValidationResult,
} from '../parametric/types'

export type WaveLampBaseType = WaveLampSeatMode

export type DecorativeParameters = ParameterValues & {
  height: number
  bottomDiameter: number
  topDiameter: number
  wallThickness: number
  waves: number
  amplitude: number
  twist: number
  bottomAdaptationHeight: number
  verticalSegments: number
  radialSegments: number
  patternCount?: number
  patternAmplitude?: number
  waveAmplitude?: number
  twistAngle?: number
}

export type BaseParameters = ParameterValues & {
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
}

export type WaveLampParameterValues = DecorativeParameters & BaseParameters

const numberParameter = (
  id: string,
  label: string,
  description: string,
  min: number,
  max: number | ((values: ParameterValues) => number),
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

const seatModeParameter: SelectParameterDefinition = {
  id: 'seatMode',
  label: 'Shade seat',
  description: 'Choose the peripheral circular seat used by the shade collar.',
  type: 'select',
  options: [
    { value: 'recessed-seat', label: 'Recessed Seat' },
    { value: 'raised-lip', label: 'Raised Lip' },
  ],
}

const shadeParameters: readonly ParameterDefinition[] = [
  numberParameter('height', 'Height', 'Overall height of the decorative shade.', 50, 500, 1),
  numberParameter('bottomDiameter', 'Bottom diameter', 'Decorative shade body diameter before the circular collar adaptation.', 40, 400, 1),
  numberParameter('topDiameter', 'Top diameter', 'Outside diameter at the upper end of the shade.', 40, 400, 1),
  numberParameter('wallThickness', 'Wall thickness', 'Radial material thickness of the shade.', 0.4, 10, 0.1),
  numberParameter('waves', 'Waves', 'Number of radial decorative waves.', 3, 64, 1, 'count', true),
  numberParameter('amplitude', 'Amplitude', 'Radial wave amplitude as a percentage of the local radius.', 0, 40, 0.5, '%'),
  numberParameter('twist', 'Twist', 'Progressive twist from the mounting end to the top.', -360, 360, 1, 'deg'),
  numberParameter('bottomAdaptationHeight', 'Bottom adaptation', 'Height of the final smootherstep transition into the circular collar.', 1, 100, 0.5),
]

const baseParameters: readonly ParameterDefinition[] = [
  seatModeParameter,
  numberParameter('baseDiameter', 'Base diameter', 'Outside diameter of the solid low plinth.', 40, 400, 1),
  numberParameter('baseThickness', 'Base thickness', 'Total height of the structural plinth.', 1, 100, 0.5),
  numberParameter('bottomThickness', 'Bottom thickness', 'Solid floor left below the local cable passage.', 0.5, 50, 0.5),
  numberParameter('fitClearance', 'Fit clearance', 'Radial clearance applied between the circular collar and peripheral seat.', 0, 2, 0.05),
  numberParameter('pedestalDiameter', 'Pedestal diameter', 'Independent central pedestal outside diameter.', 4, 120, 1),
  numberParameter('pedestalHeight', 'Pedestal height', 'Height of the central lamp-holder pedestal.', 1, 80, 0.5),
  numberParameter('holderOpeningDiameter', 'Holder opening', 'Central pedestal opening used by the holder reference.', 1, 100, 0.5),
  numberParameter('cableChannelWidth', 'Cable channel width', 'Width of the local radial cable passage.', 1, 40, 0.5),
  numberParameter('cableChannelDepth', 'Cable channel depth', 'Depth of the local cable passage while preserving the bottom floor.', 0.5, 40, 0.5),
]

const resolutionParameters: readonly NumberParameterDefinition[] = [
  numberParameter('verticalSegments', 'Vertical segments', 'Mesh resolution along the shade height.', 20, 300, 1, 'segments', true),
  numberParameter('radialSegments', 'Radial segments', 'Mesh resolution around the circumference.', 32, 512, 1, 'segments', true),
]

const waveLampParameters: readonly ParameterDefinition[] = [
  ...shadeParameters,
  ...baseParameters,
  ...resolutionParameters,
]

const waveLampParameterSchema: readonly ParameterSection[] = [
  {
    id: 'decorative-shade',
    label: 'Decorative Shade',
    description: 'Wave and twist remain unchanged above the lower circular adaptation zone.',
    groups: [
      { id: 'shade', label: 'Shade', parameters: shadeParameters },
      { id: 'resolution', label: 'Resolution', parameters: resolutionParameters },
    ] satisfies readonly ParameterGroup[],
  },
  {
    id: 'base-holder',
    label: 'Base / Holder',
    description: 'A solid plinth has a peripheral shade seat and an independent central holder pedestal.',
    groups: [
      { id: 'base', label: 'Base', parameters: baseParameters },
    ] satisfies readonly ParameterGroup[],
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
  bottomAdaptationHeight: 8,
  seatMode: 'recessed-seat',
  baseDiameter: 120,
  baseThickness: 8,
  bottomThickness: 3,
  fitClearance: 0.25,
  pedestalDiameter: 30,
  pedestalHeight: 18,
  holderOpeningDiameter: 12,
  cableChannelWidth: 8,
  cableChannelDepth: 4,
  verticalSegments: 100,
  radialSegments: 128,
}

const createWaveLampRequest = (parameters: WaveLampParameterValues): GeometryRequest => ({
  backend: 'procedural',
  operation: 'wave-lamp',
  parameters,
})

function value(parameters: ParameterValues, id: string, aliases: readonly string[] = []): ParameterValues[string] | undefined {
  return parameters[id] ?? aliases.map((alias) => parameters[alias]).find((candidate) => candidate !== undefined)
}

function numberValue(
  parameters: ParameterValues,
  id: string,
  aliases: readonly string[] = [],
  fallback = Number.NaN,
): number {
  const candidate = Number(value(parameters, id, aliases))
  return Number.isFinite(candidate) ? candidate : fallback
}

export function waveLampDecorativeParameters(parameters: WaveLampParameterValues): DecorativeParameters {
  return {
    height: numberValue(parameters, 'height'),
    bottomDiameter: numberValue(parameters, 'bottomDiameter', ['maxDiameter']),
    topDiameter: numberValue(parameters, 'topDiameter'),
    wallThickness: numberValue(parameters, 'wallThickness'),
    waves: numberValue(parameters, 'waves', ['patternCount']),
    amplitude: numberValue(parameters, 'amplitude', ['patternAmplitude', 'waveAmplitude']),
    twist: numberValue(parameters, 'twist', ['twistAngle']),
    bottomAdaptationHeight: numberValue(parameters, 'bottomAdaptationHeight', ['rimTransitionHeight'], 8),
    verticalSegments: numberValue(parameters, 'verticalSegments'),
    radialSegments: numberValue(parameters, 'radialSegments'),
  }
}

export function waveLampBaseParameters(parameters: WaveLampParameterValues): LampBaseParameters {
  return {
    baseDiameter: numberValue(parameters, 'baseDiameter'),
    baseThickness: numberValue(parameters, 'baseThickness'),
    bottomThickness: numberValue(parameters, 'bottomThickness'),
    seatMode: parameters.seatMode,
    fitClearance: numberValue(parameters, 'fitClearance'),
    pedestalDiameter: numberValue(parameters, 'pedestalDiameter'),
    pedestalHeight: numberValue(parameters, 'pedestalHeight'),
    holderOpeningDiameter: numberValue(parameters, 'holderOpeningDiameter'),
    cableChannelWidth: numberValue(parameters, 'cableChannelWidth'),
    cableChannelDepth: numberValue(parameters, 'cableChannelDepth'),
    radialSegments: numberValue(parameters, 'radialSegments'),
    shadeSeat: deriveWaveLampShadeSeat(parameters),
  }
}

export { deriveWaveLampShadeSeat }

function validateWaveLamp(parameters: WaveLampParameterValues): ValidationResult {
  const errors: string[] = []
  const height = numberValue(parameters, 'height')
  const bottomDiameter = numberValue(parameters, 'bottomDiameter', ['maxDiameter'])
  const topDiameter = numberValue(parameters, 'topDiameter')
  const wallThickness = numberValue(parameters, 'wallThickness')
  const waves = numberValue(parameters, 'waves', ['patternCount'])
  const amplitude = numberValue(parameters, 'amplitude', ['patternAmplitude', 'waveAmplitude'])
  const twist = numberValue(parameters, 'twist', ['twistAngle'])
  const adaptationHeight = numberValue(parameters, 'bottomAdaptationHeight', ['rimTransitionHeight'])
  const verticalSegments = numberValue(parameters, 'verticalSegments')
  const radialSegments = numberValue(parameters, 'radialSegments')

  if (!Number.isFinite(height) || height < 50 || height > 500) errors.push('Height must be between 50 and 500 mm.')
  if (!Number.isFinite(bottomDiameter) || bottomDiameter < 40 || bottomDiameter > 400) errors.push('Bottom diameter must be between 40 and 400 mm.')
  if (!Number.isFinite(topDiameter) || topDiameter < 40 || topDiameter > 400) errors.push('Top diameter must be between 40 and 400 mm.')
  if (!Number.isFinite(wallThickness) || wallThickness < 0.4 || wallThickness > 10) errors.push('Wall thickness must be between 0.4 and 10 mm.')
  if (!Number.isInteger(waves) || waves < 3 || waves > 64) errors.push('Waves must be an integer between 3 and 64.')
  if (!Number.isFinite(amplitude) || amplitude < 0 || amplitude > 40) errors.push('Amplitude must be between 0 and 40 percent.')
  if (!Number.isFinite(twist) || twist < -360 || twist > 360) errors.push('Twist must be between -360 and 360 degrees.')
  if (!Number.isFinite(adaptationHeight) || adaptationHeight <= 0) errors.push('Bottom adaptation height must be positive.')
  if (Number.isFinite(height) && Number.isFinite(adaptationHeight) && adaptationHeight >= height) errors.push('Bottom adaptation height must be less than shade height.')
  if (!Number.isInteger(verticalSegments) || verticalSegments < 20 || verticalSegments > 300) errors.push('Vertical segments must be an integer between 20 and 300.')
  if (!Number.isInteger(radialSegments) || radialSegments < 32 || radialSegments > 512) errors.push('Radial segments must be an integer between 32 and 512.')
  if (Number.isFinite(bottomDiameter) && bottomDiameter <= wallThickness * 2) errors.push('Bottom diameter must be greater than twice the wall thickness.')
  if (Number.isFinite(topDiameter) && topDiameter <= wallThickness * 2) errors.push('Top diameter must be greater than twice the wall thickness.')
  if (Number.isFinite(bottomDiameter) && Number.isFinite(topDiameter) && Number.isFinite(amplitude)) {
    const minimumBodyRadius = Math.min(bottomDiameter, topDiameter) / 2
    const minimumDecorativeRadius = minimumBodyRadius * (1 - amplitude / 100)
    if (minimumDecorativeRadius <= wallThickness) errors.push('Amplitude is too large for the current wall thickness.')
  }

  const baseParameters = waveLampBaseParameters(parameters)
  errors.push(...validateLampBaseParameters(baseParameters).errors)
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
  description: 'A wave shade with a smooth circular bottom collar, peripheral base seat, independent holder pedestal, and local cable passage.',
  metadata: {
    name: 'Wave Lamp',
    category: 'Lamps',
    description: 'A wave shade with a smooth circular bottom collar, peripheral base seat, independent holder pedestal, and local cable passage.',
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
