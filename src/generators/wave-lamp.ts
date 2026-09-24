import type { GeometryRequest } from '../geometry/types'
import {
  deriveMechanicalCoreDimensions,
  validateMechanicalCoreInput,
  type MechanicalCoreInput,
} from '../geometry/mechanicalCore'
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

export type WaveLampParameterValues = ParameterValues & {
  height: number
  maxDiameter: number
  topDiameter: number
  wallThickness: number
  waves: number
  waveAmplitude: number
  twist: number
  mountType: 'none' | 'threaded'
  nominalThreadDiameter: number
  threadPitch: number
  threadClearance: number
  cableHoleDiameter: number
  supportInset: number
  supportThickness: number
  verticalSegments: number
  radialSegments: number
}

const numberParameter = (
  id: string,
  label: string,
  description: string,
  min: number,
  max: number | ((values: ParameterValues) => number),
  step: number,
  visibleWhen?: ParameterDefinition['visibleWhen'],
  integer = false,
): NumberParameterDefinition => ({
  id,
  label,
  description,
  type: 'number',
  unit: 'mm',
  min,
  max,
  step,
  ...(visibleWhen ? { visibleWhen } : {}),
  ...(integer ? { integer: true } : {}),
})

const mountTypeParameter: SelectParameterDefinition = {
  id: 'mountType',
  label: 'Mount type',
  description: 'Choose whether the shade is standalone or uses the threaded mechanical core.',
  type: 'select',
  options: [
    { value: 'none', label: 'None' },
    { value: 'threaded', label: 'Threaded' },
  ],
}

const shadeParameters: readonly ParameterDefinition[] = [
  numberParameter('height', 'Height', 'Overall height of the decorative shade.', 50, 500, 1),
  numberParameter('maxDiameter', 'Maximum diameter', 'Lower shade diameter and maximum exterior diameter before waves.', 40, 400, 1),
  numberParameter('topDiameter', 'Top diameter', 'Exterior diameter at the top before waves.', 40, 400, 1),
  numberParameter('wallThickness', 'Wall thickness', 'Radial material thickness of the shade.', 0.4, 10, 0.1),
  numberParameter('waves', 'Waves', 'Number of sinusoidal lobes around the shade.', 3, 64, 1, undefined, true),
  numberParameter(
    'waveAmplitude',
    'Wave amplitude',
    'Radial height of each circumferential wave.',
    0,
    (values) => Math.min(40, Math.max(0, Math.min(Number(values.maxDiameter), Number(values.topDiameter)) / 2 - Number(values.wallThickness) - 1)),
    0.5,
  ),
  numberParameter('twist', 'Twist', 'Progressive twist from the lower rim to the top.', -360, 360, 1),
]

const threadedWhen: ParameterDefinition['visibleWhen'] = { parameterId: 'mountType', equals: 'threaded' }
const mechanicalParameters: readonly ParameterDefinition[] = [
  mountTypeParameter,
  numberParameter('nominalThreadDiameter', 'Nominal thread diameter', 'Nominal diameter shared by the hub and retaining ring.', 8, 80, 0.5, threadedWhen),
  numberParameter('threadPitch', 'Thread pitch', 'Axial distance between thread turns.', 0.5, 8, 0.1, threadedWhen),
  numberParameter('threadClearance', 'Thread clearance', 'Radial clearance for the hub and retaining ring threads.', 0, 4, 0.05, threadedWhen),
  numberParameter(
    'cableHoleDiameter',
    'Cable hole diameter',
    'Cable passage through the circular hub opening.',
    0,
    (values) => Math.max(0, Number(values.nominalThreadDiameter) + Number(values.threadClearance) * 2 - 0.5),
    0.5,
    threadedWhen,
  ),
  numberParameter(
    'supportInset',
    'Support inset',
    'Distance from the shade mounting end to the annular support plate.',
    0.1,
    (values) => Math.max(0.1, Number(values.height) - Number(values.supportThickness)),
    0.5,
    threadedWhen,
  ),
  numberParameter(
    'supportThickness',
    'Support thickness',
    'Axial thickness of the annular support plate.',
    0.4,
    (values) => Math.max(0.4, Number(values.height) - Number(values.supportInset)),
    0.1,
    threadedWhen,
  ),
]

const resolutionParameters: readonly NumberParameterDefinition[] = [
  numberParameter('verticalSegments', 'Vertical segments', 'Mesh resolution along the height.', 20, 300, 1, undefined, true),
  numberParameter('radialSegments', 'Radial segments', 'Mesh resolution around the circumference.', 32, 512, 1, undefined, true),
]

const waveLampParameters: readonly ParameterDefinition[] = [
  ...shadeParameters,
  ...mechanicalParameters,
  ...resolutionParameters,
]

const waveLampParameterSchema: readonly ParameterSection[] = [
  {
    id: 'decorative-shade',
    label: 'Decorative Shade',
    description: 'The visible wave shade is independent of the mechanical core.',
    groups: [
      { id: 'shade', label: 'Shade', parameters: shadeParameters },
      { id: 'resolution', label: 'Resolution', parameters: resolutionParameters },
    ] satisfies readonly ParameterGroup[],
  },
  {
    id: 'mechanical-core',
    label: 'Mechanical Core',
    description: 'A derived threaded hub, annular support, and retaining ring.',
    groups: [
      { id: 'mechanical', label: 'Mechanical', parameters: mechanicalParameters },
    ] satisfies readonly ParameterGroup[],
  },
]

const waveLampDefaults: WaveLampParameterValues = {
  height: 180,
  maxDiameter: 120,
  topDiameter: 100,
  wallThickness: 1.2,
  waves: 12,
  waveAmplitude: 8,
  twist: 45,
  mountType: 'none',
  nominalThreadDiameter: 40,
  threadPitch: 2,
  threadClearance: 0.2,
  cableHoleDiameter: 10,
  supportInset: 10,
  supportThickness: 2,
  verticalSegments: 100,
  radialSegments: 128,
}

const createWaveLampRequest = (parameters: WaveLampParameterValues): GeometryRequest => ({
  backend: 'procedural',
  operation: 'wave-lamp',
  parameters,
})

function mechanicalInput(parameters: WaveLampParameterValues): MechanicalCoreInput {
  return {
    mountType: parameters.mountType,
    nominalThreadDiameter: Number(parameters.nominalThreadDiameter),
    threadPitch: Number(parameters.threadPitch),
    threadClearance: Number(parameters.threadClearance),
    cableHoleDiameter: Number(parameters.cableHoleDiameter),
    supportInset: Number(parameters.supportInset),
    supportThickness: Number(parameters.supportThickness),
    wallThickness: Number(parameters.wallThickness),
    height: Number(parameters.height),
    radialSegments: Number(parameters.radialSegments),
    maxDiameter: Number(parameters.maxDiameter),
  }
}

function validateWaveLamp(parameters: WaveLampParameterValues): ValidationResult {
  const errors: string[] = []
  const height = Number(parameters.height)
  const maxDiameter = Number(parameters.maxDiameter)
  const topDiameter = Number(parameters.topDiameter)
  const wallThickness = Number(parameters.wallThickness)
  const waves = Number(parameters.waves)
  const waveAmplitude = Number(parameters.waveAmplitude)
  const twist = Number(parameters.twist)
  const verticalSegments = Number(parameters.verticalSegments)
  const radialSegments = Number(parameters.radialSegments)
  const mountType = String(parameters.mountType ?? 'none')

  if (!Number.isFinite(height) || height < 50 || height > 500) errors.push('Height must be between 50 and 500 mm.')
  if (!Number.isFinite(maxDiameter) || maxDiameter < 40 || maxDiameter > 400) {
    errors.push('Maximum diameter must be between 40 and 400 mm.')
  }
  if (!Number.isFinite(topDiameter) || topDiameter < 40 || topDiameter > 400) {
    errors.push('Top diameter must be between 40 and 400 mm.')
  }
  if (!Number.isFinite(wallThickness) || wallThickness < 0.4 || wallThickness > 10) {
    errors.push('Wall thickness must be between 0.4 and 10 mm.')
  }
  if (!Number.isInteger(waves) || waves < 3 || waves > 64) errors.push('Waves must be an integer between 3 and 64.')
  if (!Number.isFinite(waveAmplitude) || waveAmplitude < 0 || waveAmplitude > 40) {
    errors.push('Wave amplitude must be between 0 and 40 mm.')
  }
  if (!Number.isFinite(twist) || twist < -360 || twist > 360) errors.push('Twist must be between -360 and 360 degrees.')
  if (!Number.isInteger(verticalSegments) || verticalSegments < 20 || verticalSegments > 300) {
    errors.push('Vertical segments must be an integer between 20 and 300.')
  }
  if (!Number.isInteger(radialSegments) || radialSegments < 32 || radialSegments > 512) {
    errors.push('Radial segments must be an integer between 32 and 512.')
  }
  if (mountType !== 'none' && mountType !== 'threaded') errors.push('Mount type must be None or Threaded.')

  if (Number.isFinite(maxDiameter) && Number.isFinite(wallThickness) && maxDiameter <= wallThickness * 2) {
    errors.push('Maximum diameter must be greater than twice the wall thickness.')
  }
  if (Number.isFinite(topDiameter) && Number.isFinite(wallThickness) && topDiameter <= wallThickness * 2) {
    errors.push('Top diameter must be greater than twice the wall thickness.')
  }
  if (Number.isFinite(maxDiameter) && Number.isFinite(topDiameter) && Number.isFinite(waveAmplitude) && Number.isFinite(wallThickness)) {
    const minimumShadeRadius = Math.min(maxDiameter, topDiameter) / 2 - waveAmplitude
    if (minimumShadeRadius <= wallThickness) errors.push('Wave amplitude too large for current wall thickness.')
  }

  if (mountType === 'threaded') {
    const input = mechanicalInput(parameters)
    const mechanicalValidation = validateMechanicalCoreInput(input)
    errors.push(...mechanicalValidation.errors)
    if (mechanicalValidation.valid) {
      const dimensions = deriveMechanicalCoreDimensions(input)
      const minimumShadeRadius = Math.min(maxDiameter, topDiameter) / 2 - waveAmplitude
      if (minimumShadeRadius - wallThickness <= dimensions.supportInnerDiameter / 2) {
        errors.push('Support plate would not reach the shade inner wall.')
      }
      const ringThreadLength = Math.max(input.threadPitch * 3, dimensions.ringHeight - input.threadPitch)
      if (Math.min(dimensions.threadLength, ringThreadLength) < input.threadPitch) {
        errors.push('Retaining ring engagement is insufficient.')
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

function quantize(value: number, step: number, min: number, max: number): number {
  const clamped = Math.min(max, Math.max(min, value))
  return Math.round((clamped - min) / step) * step + min
}

function randomizeWaveLamp(parameters: WaveLampParameterValues, random = Math.random): WaveLampParameterValues {
  const wallThickness = Number(parameters.wallThickness)
  const maxDiameter = Math.round(80 + random() * 220)
  const topDiameter = Math.round(70 + random() * 200)
  const minimumRadius = Math.min(maxDiameter, topDiameter) / 2
  const maximumAmplitude = Math.min(40, Math.max(0, minimumRadius - wallThickness - 1))

  return {
    ...parameters,
    height: Math.round(120 + random() * 240),
    maxDiameter,
    topDiameter,
    waves: Math.round(6 + random() * 18),
    waveAmplitude: quantize(random() * maximumAmplitude, 0.5, 0, maximumAmplitude),
    twist: Math.round(-120 + random() * 240),
  }
}

export const parametricWaveLamp: ParametricModelDefinition<WaveLampParameterValues> = {
  id: 'wave-lamp',
  name: 'Wave Lamp',
  category: 'Lamps',
  description: 'A closed, hollow lampshade with a twisted radial wave profile.',
  metadata: {
    name: 'Wave Lamp',
    category: 'Lamps',
    description: 'A closed, hollow lampshade with a twisted radial wave profile.',
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
