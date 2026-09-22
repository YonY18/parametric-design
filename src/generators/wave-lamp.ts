import { FRAME_TOLERANCE, type GeometryRequest } from '../geometry/types'
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
import { genericMountPresets, validateGenericThreadedMount } from '../geometry/mounts'
import { validateRetainingRing, type RetainingGripStyle } from '../geometry/retainingRing'
import { validateInternalShadeSupport, type InternalShadeSupportType } from '../geometry/internalShadeSupport'
import { validateThreadedHub } from '../geometry/threadedHub'
import {
  defaultAttachmentInterface,
  deriveMountParameters,
  deriveRetainingRingParameters,
  resolveAttachmentInterface,
  validateAttachmentInterface,
  type MountBodyParameters,
  type RetainingRingGripParameters,
} from '../geometry/attachmentInterface'
import { validateTransition, type TransitionType } from '../geometry/transitions'

export type WaveLampParameterValues = ParameterValues & {
  height: number
  bottomDiameter: number
  topDiameter: number
  wallThickness: number
  mountType: 'none' | 'generic-threaded'
  mountPreset: string
  mountOuterDiameter: number
  mountInnerDiameter: number
  mountHeight: number
  /** Deprecated compatibility fields; Attachment Interface fields are canonical. */
  mountThreadDiameter: number
  mountThreadPitch: number
  mountThreadLength: number
  mountThreadDirection: 'right' | 'left'
  mountThreadClearance: number
  mountWallThickness: number
  mountCableHoleDiameter: number
  mountSupportLipEnabled: boolean
  mountSupportLipInnerDiameter: number
  mountSupportLipOuterDiameter: number
  mountSupportLipThickness: number
  mountSupportLipZ: number
  retainingRingOuterDiameter: number
  retainingRingInnerDiameter: number
  retainingRingHeight: number
  retainingRingWallThickness: number
  /** Deprecated compatibility fields; Attachment Interface fields are canonical. */
  retainingRingThreadDiameter: number
  retainingRingThreadPitch: number
  retainingRingThreadLength: number
  retainingRingThreadClearance: number
  retainingRingThreadDirection: 'right' | 'left'
  retainingRingGripStyle: RetainingGripStyle
  retainingRingGripDepth: number
  retainingRingGripCount: number
  shadeNeckOuterDiameter: number
  shadeNeckInnerDiameter: number
  shadeNeckHeight: number
  shadeFlangeOuterDiameter: number
  shadeFlangeInnerDiameter: number
  shadeFlangeThickness: number
  shadeFlangePosition: number
  shadeSeatClearance: number
  attachmentThreadDiameter: number
  attachmentThreadPitch: number
  attachmentThreadLength: number
  attachmentThreadClearance: number
  attachmentThreadDirection: 'right' | 'left'
  attachmentSeatOuterDiameter: number
  attachmentSeatInnerDiameter: number
  attachmentFlangeThickness: number
  attachmentFlangeRadialClearance: number
  attachmentNeckHeight: number
  attachmentRingHeight: number
  attachmentRingWallThickness: number
  transitionType: TransitionType
  transitionHeight: number
  blendHeight: number
  decorativeStartRadius: number
  transitionStartRadius: number
  transitionEndRadius: number
  supportType: InternalShadeSupportType
  supportInset: number
  supportThickness: number
  hubOuterDiameter: number
  hubHeight: number
  hubWallThickness: number
  waves: number
  waveAmplitude: number
  wavePhase: number
  twist: number
  bulgeAmount: number
  bulgeCenter: number
  bulgeWidth: number
  verticalWaveCount: number
  verticalWaveAmplitude: number
  verticalWavePhase: number
  taperBottomScale: number
  taperTopScale: number
  taperEnabled: boolean
  waveEnabled: boolean
  twistEnabled: boolean
  bulgeEnabled: boolean
  verticalWaveEnabled: boolean
  verticalSegments: number
  radialSegments: number
}

const baseParameters: readonly NumberParameterDefinition[] = [
  {
    id: 'height',
    label: 'Height',
    description: 'Overall height of the lampshade.',
    type: 'number',
    unit: 'mm',
    min: 50,
    max: 500,
    step: 1,
  },
  {
    id: 'bottomDiameter',
    label: 'Bottom diameter',
    description: 'Outside diameter at the lower rim before deformation.',
    type: 'number',
    unit: 'mm',
    min: 40,
    max: 400,
    step: 1,
  },
  {
    id: 'topDiameter',
    label: 'Top diameter',
    description: 'Outside diameter at the upper rim before deformation.',
    type: 'number',
    unit: 'mm',
    min: 40,
    max: 400,
    step: 1,
  },
  {
    id: 'wallThickness',
    label: 'Wall thickness',
    description: 'Approximate radial material thickness around the open center.',
    type: 'number',
    unit: 'mm',
    min: 0.4,
    max: 10,
    step: 0.1,
  },
]

const mountTypeParameter: SelectParameterDefinition = {
  id: 'mountType',
  label: 'Type',
  description: 'Select a mount composition for the shade.',
  type: 'select',
  options: [
    { value: 'none', label: 'None' },
    { value: 'generic-threaded', label: 'Generic Threaded' },
  ],
}

const mountPresetValues = Object.fromEntries([
  ['none', { mountType: 'none' }],
  ...genericMountPresets.map((preset) => [preset.id, {
    mountType: 'generic-threaded',
    mountOuterDiameter: preset.parameters.outerDiameter,
    mountInnerDiameter: preset.parameters.innerDiameter,
    mountHeight: preset.parameters.height,
    mountThreadDiameter: preset.parameters.threadDiameter,
    mountThreadPitch: preset.parameters.threadPitch,
    mountThreadLength: preset.parameters.threadLength,
    mountThreadDirection: preset.parameters.threadDirection,
    mountThreadClearance: preset.parameters.threadClearance,
    mountWallThickness: preset.parameters.wallThickness,
    mountCableHoleDiameter: preset.parameters.cableHoleDiameter,
    mountSupportLipEnabled: preset.parameters.supportLipEnabled,
    mountSupportLipInnerDiameter: preset.parameters.supportLipInnerDiameter,
    mountSupportLipOuterDiameter: preset.parameters.supportLipOuterDiameter,
    mountSupportLipThickness: preset.parameters.supportLipThickness,
    mountSupportLipZ: preset.parameters.supportLipZ,
    attachmentThreadDiameter: preset.parameters.threadDiameter,
    attachmentThreadPitch: preset.parameters.threadPitch,
    attachmentThreadLength: preset.parameters.threadLength,
    attachmentThreadClearance: preset.parameters.threadClearance,
    attachmentThreadDirection: preset.parameters.threadDirection,
    attachmentSeatInnerDiameter: preset.parameters.supportLipInnerDiameter,
    attachmentSeatOuterDiameter: preset.parameters.supportLipOuterDiameter,
    attachmentFlangeThickness: preset.parameters.supportLipThickness,
    attachmentFlangeRadialClearance: defaultAttachmentInterface.flangeRadialClearance,
    attachmentNeckHeight: defaultAttachmentInterface.neckHeight,
    attachmentRingHeight: defaultAttachmentInterface.ringHeight,
    attachmentRingWallThickness: defaultAttachmentInterface.ringWallThickness,
  } satisfies Partial<ParameterValues>]),
]) as Record<string, Partial<ParameterValues>>

const mountPresetParameter: SelectParameterDefinition = {
  id: 'mountPreset',
  label: 'Preset',
  description: 'In-memory starting values; these are not electrical standards and remain editable.',
  type: 'select',
  options: [
    { value: 'none', label: 'Custom / none' },
    ...genericMountPresets.map((preset) => ({ value: preset.id, label: preset.label })),
  ],
  presetValues: mountPresetValues,
}

const genericMountNumber = (
  id: string,
  label: string,
  description: string,
  min: number,
  max: number,
  step: number,
): NumberParameterDefinition => ({
  id,
  label,
  description,
  type: 'number',
  unit: 'mm',
  min,
  max,
  step,
  visibleWhen: { parameterId: 'mountType', equals: 'generic-threaded' },
})

const genericMountParameters: readonly ParameterDefinition[] = [
  mountTypeParameter,
  mountPresetParameter,
  genericMountNumber('mountOuterDiameter', 'Outer diameter', 'Outside diameter of the mount body.', 0.1, 300, 0.5),
  genericMountNumber('mountInnerDiameter', 'Inner diameter', 'Inside diameter of the mount body.', 0.1, 300, 0.5),
  genericMountNumber('mountHeight', 'Mount height', 'Axial height of the mount.', 0.1, 200, 0.5),
  genericMountNumber('mountWallThickness', 'Mount wall thickness', 'Minimum radial wall around the mount opening.', 0.1, 50, 0.1),
  genericMountNumber('mountCableHoleDiameter', 'Cable hole diameter', 'Cable passage diameter through the mount.', 0, 250, 0.5),
]

const attachmentNumber = (
  id: string,
  label: string,
  description: string,
  min: number,
  max: number,
  step: number,
): NumberParameterDefinition => ({
  id,
  label,
  description,
  type: 'number',
  unit: 'mm',
  min,
  max,
  step,
  visibleWhen: { parameterId: 'mountType', equals: 'generic-threaded' },
})

const attachmentInterfaceParameters: readonly ParameterDefinition[] = [
  attachmentNumber('attachmentThreadDiameter', 'Nominal thread diameter', 'Canonical external and internal thread diameter.', 0.1, 300, 0.5),
  attachmentNumber('attachmentThreadPitch', 'Thread pitch', 'Canonical axial distance between thread turns.', 0.01, 50, 0.1),
  attachmentNumber('attachmentThreadLength', 'Thread length', 'Canonical threaded engagement length.', 0.01, 200, 0.5),
  attachmentNumber('attachmentThreadClearance', 'Thread clearance', 'Canonical radial clearance for both thread interfaces.', 0, 10, 0.05),
  {
    id: 'attachmentThreadDirection',
    label: 'Thread direction',
    description: 'Canonical winding direction for both thread interfaces.',
    type: 'select',
    options: [{ value: 'right', label: 'Right-hand' }, { value: 'left', label: 'Left-hand' }],
    visibleWhen: { parameterId: 'mountType', equals: 'generic-threaded' },
  },
  attachmentNumber('attachmentSeatOuterDiameter', 'Seat outer diameter', 'Canonical Mount Seat outside diameter.', 0.1, 300, 0.5),
  attachmentNumber('attachmentSeatInnerDiameter', 'Seat inner diameter', 'Canonical Mount Seat opening diameter.', 0.1, 300, 0.5),
  attachmentNumber('attachmentFlangeThickness', 'Flange thickness', 'Canonical shade flange thickness captured by the ring.', 0.01, 50, 0.1),
  attachmentNumber('attachmentFlangeRadialClearance', 'Flange radial clearance', 'Clearance used to derive flange and neck diameters.', 0, 10, 0.05),
  attachmentNumber('attachmentNeckHeight', 'Neck height', 'Straight neck height before decorative deformation.', 0.1, 100, 0.5),
  attachmentNumber('attachmentRingHeight', 'Retaining ring height', 'Axial height of the retaining ring.', 0.1, 100, 0.5),
  attachmentNumber('attachmentRingWallThickness', 'Retaining ring wall thickness', 'Canonical radial wall around the internal thread.', 0.1, 50, 0.1),
]

const retainingRingNumber = (
  id: string,
  label: string,
  description: string,
  min: number,
  max: number,
  step: number,
): NumberParameterDefinition => ({
  id,
  label,
  description,
  type: 'number',
  unit: 'mm',
  min,
  max,
  step,
  visibleWhen: { parameterId: 'mountType', equals: 'generic-threaded' },
})

const retainingRingParameters: readonly ParameterDefinition[] = [
  {
    id: 'retainingRingGripStyle',
    label: 'Grip style',
    description: 'Outer grip detail on the retaining ring.',
    type: 'select',
    options: [{ value: 'smooth', label: 'Smooth' }, { value: 'ribs', label: 'Ribs' }, { value: 'scalloped', label: 'Scalloped' }],
    visibleWhen: { parameterId: 'mountType', equals: 'generic-threaded' },
  },
  retainingRingNumber('retainingRingGripDepth', 'Grip depth', 'Radial depth of the grip detail.', 0, 20, 0.1),
  retainingRingNumber('retainingRingGripCount', 'Grip count', 'Number of ribs or scallops around the ring.', 3, 128, 1),
]

const supportTypeParameter: SelectParameterDefinition = {
  id: 'supportType',
  label: 'Support type',
  description: 'Internal shade support architecture; only annular is currently implemented.',
  type: 'select',
  options: [
    { value: 'annular', label: 'Annular' },
    { value: '3-arm', label: '3-arm (future)' },
    { value: '4-arm', label: '4-arm (future)' },
  ],
  visibleWhen: { parameterId: 'mountType', equals: 'generic-threaded' },
}

const supportNumber = (
  id: string,
  label: string,
  description: string,
  min: number,
  max: number,
  step: number,
): NumberParameterDefinition => ({
  id,
  label,
  description,
  type: 'number',
  unit: 'mm',
  min,
  max,
  step,
  visibleWhen: { parameterId: 'mountType', equals: 'generic-threaded' },
})

const internalShadeSupportParameters: readonly ParameterDefinition[] = [
  supportTypeParameter,
  supportNumber('supportInset', 'Support inset', 'Distance from the shade mounting end to the internal support plate.', 0.1, 100, 0.5),
  supportNumber('supportThickness', 'Support thickness', 'Axial thickness of the internal support plate.', 0.4, 10, 0.1),
  supportNumber('hubOuterDiameter', 'Hub outer diameter', 'Circular Threaded Hub outside diameter.', 20, 100, 0.5),
  supportNumber('hubHeight', 'Hub height', 'Axial height of the circular Threaded Hub.', 0.5, 100, 0.5),
  supportNumber('hubWallThickness', 'Hub wall thickness', 'Minimum radial wall around the Threaded Hub opening.', 0.4, 20, 0.1),
]

const transitionTypeParameter: SelectParameterDefinition = {
  id: 'transitionType',
  label: 'Type',
  description: 'Legacy standalone shade transition; mounted lamps use an internal support instead.',
  type: 'select',
  visibleWhen: { parameterId: 'mountType', equals: 'none' },
  options: [
    { value: 'straight', label: 'Straight' },
    { value: 'linear-flare', label: 'Linear Flare' },
    { value: 'smooth', label: 'Smooth' },
  ],
}

const transitionNumber = (
  id: string,
  label: string,
  description: string,
): NumberParameterDefinition => ({
  id,
  label,
  description,
  type: 'number',
  unit: 'mm',
  min: 0,
  max: 300,
  step: 0.5,
  visibleWhen: { parameterId: 'mountType', equals: 'none' },
})

const transitionParameters: readonly ParameterDefinition[] = [
  transitionTypeParameter,
  transitionNumber('transitionHeight', 'Height', 'Optional height for a standalone shade transition.'),
  transitionNumber('blendHeight', 'Blend height', 'Standalone shade transition blend height; not used by mounted lamps.'),
  transitionNumber('decorativeStartRadius', 'Decorative start radius', 'Standalone shade transition end radius; not used by mounted lamps.'),
  transitionNumber('transitionStartRadius', 'Start radius', 'Standalone shade transition start radius; not used by mounted lamps.'),
  transitionNumber('transitionEndRadius', 'End radius', 'Standalone shade transition end radius; not used by mounted lamps.'),
]

const enabledParameter = (id: string, label: string): ParameterDefinition => ({
  id,
  label: 'Enabled',
  description: `Apply the ${label} deformer in the ordered shape pipeline.`,
  type: 'boolean',
})

const taperParameters: readonly ParameterDefinition[] = [
  enabledParameter('taperEnabled', 'Taper'),
  {
    id: 'taperBottomScale',
    label: 'Bottom scale',
    description: 'Relative radial scale applied at the bottom of the shade.',
    type: 'number',
    unit: '×',
    min: 0.1,
    max: 4,
    step: 0.01,
  },
  {
    id: 'taperTopScale',
    label: 'Top scale',
    description: 'Relative radial scale applied at the top of the shade.',
    type: 'number',
    unit: '×',
    min: 0.1,
    max: 4,
    step: 0.01,
  },
]

const waveParameters: readonly ParameterDefinition[] = [
  enabledParameter('waveEnabled', 'Wave'),
  {
    id: 'waves',
    label: 'Waves',
    description: 'Number of sinusoidal lobes around the shade.',
    type: 'number',
    unit: 'waves',
    min: 3,
    max: 64,
    step: 1,
    integer: true,
  },
  {
    id: 'waveAmplitude',
    label: 'Wave amplitude',
    description: 'Radial height of each circumferential wave.',
    type: 'number',
    unit: 'mm',
    min: 0,
    max: 40,
    step: 0.5,
  },
  {
    id: 'wavePhase',
    label: 'Wave phase',
    description: 'Angular offset of the circumferential wave.',
    type: 'number',
    unit: 'deg',
    min: -360,
    max: 360,
    step: 1,
  },
]

const twistParameters: readonly ParameterDefinition[] = [
  enabledParameter('twistEnabled', 'Twist'),
  {
    id: 'twist',
    label: 'Twist',
    description: 'Total progressive twist from bottom to top.',
    type: 'number',
    unit: 'deg',
    min: -360,
    max: 360,
    step: 1,
  },
]

const bulgeParameters: readonly ParameterDefinition[] = [
  enabledParameter('bulgeEnabled', 'Bulge'),
  {
    id: 'bulgeAmount',
    label: 'Bulge amount',
    description: 'Radial bulge centered along the height.',
    type: 'number',
    unit: 'mm',
    min: -80,
    max: 80,
    step: 0.5,
  },
  {
    id: 'bulgeCenter',
    label: 'Bulge center',
    description: 'Normalized height of the bulge center.',
    type: 'number',
    unit: 't',
    min: 0,
    max: 1,
    step: 0.01,
  },
  {
    id: 'bulgeWidth',
    label: 'Bulge width',
    description: 'Normalized width of the bulge profile.',
    type: 'number',
    unit: 't',
    min: 0.01,
    max: 1,
    step: 0.01,
  },
]

const verticalWaveParameters: readonly ParameterDefinition[] = [
  enabledParameter('verticalWaveEnabled', 'Vertical Wave'),
  {
    id: 'verticalWaveCount',
    label: 'Vertical wave count',
    description: 'Number of radial undulations along the height.',
    type: 'number',
    unit: 'waves',
    min: 0,
    max: 64,
    step: 1,
    integer: true,
  },
  {
    id: 'verticalWaveAmplitude',
    label: 'Vertical wave amplitude',
    description: 'Radial height of the vertical wave.',
    type: 'number',
    unit: 'mm',
    min: 0,
    max: 40,
    step: 0.5,
  },
  {
    id: 'verticalWavePhase',
    label: 'Vertical wave phase',
    description: 'Height offset of the vertical wave.',
    type: 'number',
    unit: 'deg',
    min: -360,
    max: 360,
    step: 1,
  },
]

const shapeParameters: readonly ParameterDefinition[] = [
  ...taperParameters,
  ...waveParameters,
  ...twistParameters,
  ...bulgeParameters,
  ...verticalWaveParameters,
]

const resolutionParameters: readonly NumberParameterDefinition[] = [
  {
    id: 'verticalSegments',
    label: 'Vertical segments',
    description: 'Mesh resolution along the height.',
    type: 'number',
    unit: 'segments',
    min: 20,
    max: 300,
    step: 1,
    integer: true,
  },
  {
    id: 'radialSegments',
    label: 'Radial segments',
    description: 'Mesh resolution around the circumference.',
    type: 'number',
    unit: 'segments',
    min: 32,
    max: 512,
    step: 1,
    integer: true,
  },
]

const waveLampParameters: readonly ParameterDefinition[] = [
  ...genericMountParameters,
  ...attachmentInterfaceParameters,
  ...retainingRingParameters,
  ...internalShadeSupportParameters,
  ...transitionParameters,
  ...baseParameters,
  ...shapeParameters,
  ...resolutionParameters,
]

const waveLampParameterSchema: readonly ParameterSection[] = [
  {
    id: 'attachment',
    label: 'Attachment',
    description: 'Compose the lamp from an optional reusable mount profile.',
    groups: [
      { id: 'mount-definition', label: 'Mount', parameters: genericMountParameters },
    ] satisfies readonly ParameterGroup[],
  },
  {
    id: 'mechanical-interface',
    label: 'Mechanical Interface',
    description: 'Canonical mount attachment, Threaded Hub, internal support, and retaining ring interface.',
    groups: [
      { id: 'attachment-interface', label: 'Attachment Interface', parameters: attachmentInterfaceParameters },
      { id: 'retaining-ring', label: 'Retaining Ring Grip', parameters: retainingRingParameters },
      { id: 'internal-shade-support', label: 'Internal Shade Support', parameters: internalShadeSupportParameters },
    ] satisfies readonly ParameterGroup[],
  },
  {
    id: 'transition',
    label: 'Transition',
    description: 'Optional standalone shade transition; mounted lamps use internal support geometry instead.',
    groups: [
      { id: 'transition-definition', label: 'Transition', parameters: transitionParameters },
    ] satisfies readonly ParameterGroup[],
  },
  {
    id: 'base',
    label: 'Base',
    groups: [
      { id: 'dimensions', label: 'Dimensions', parameters: baseParameters },
      { id: 'resolution', label: 'Resolution', parameters: resolutionParameters },
    ] satisfies readonly ParameterGroup[],
  },
  {
    id: 'shape',
    label: 'Shape',
    description: 'Ordered deformers: Taper, Wave, Twist, Bulge, Vertical Wave.',
    groups: [
      { id: 'taper', label: 'Taper', parameters: taperParameters },
      { id: 'wave', label: 'Wave', parameters: waveParameters },
      { id: 'twist', label: 'Twist', parameters: twistParameters },
      { id: 'bulge', label: 'Bulge', parameters: bulgeParameters },
      { id: 'vertical-wave', label: 'Vertical Wave', parameters: verticalWaveParameters },
    ] satisfies readonly ParameterGroup[],
  },
]

const waveLampDefaults: WaveLampParameterValues = {
  height: 180,
  bottomDiameter: 120,
  topDiameter: 100,
  wallThickness: 1.2,
  mountType: 'none',
  mountPreset: 'none',
  mountOuterDiameter: 60,
  mountInnerDiameter: 30,
  mountHeight: 24,
  mountThreadDiameter: 40,
  mountThreadPitch: 2,
  mountThreadLength: 12,
  mountThreadDirection: 'right',
  mountThreadClearance: 0.2,
  mountWallThickness: 3,
  mountCableHoleDiameter: 10,
  mountSupportLipEnabled: true,
  mountSupportLipInnerDiameter: 42,
  mountSupportLipOuterDiameter: 60,
  mountSupportLipThickness: 2,
  mountSupportLipZ: 12,
  retainingRingOuterDiameter: 60,
  retainingRingInnerDiameter: 40,
  retainingRingHeight: 12,
  retainingRingWallThickness: 4,
  retainingRingThreadDiameter: 40,
  retainingRingThreadPitch: 2,
  retainingRingThreadLength: 10,
  retainingRingThreadClearance: 0.2,
  retainingRingThreadDirection: 'right',
  retainingRingGripStyle: 'smooth',
  retainingRingGripDepth: 0,
  retainingRingGripCount: 12,
  shadeNeckOuterDiameter: 38,
  shadeNeckInnerDiameter: 30,
  shadeNeckHeight: 8,
  shadeFlangeOuterDiameter: 58,
  shadeFlangeInnerDiameter: 43,
  shadeFlangeThickness: 2,
  shadeFlangePosition: 0,
  shadeSeatClearance: 0.4,
  attachmentThreadDiameter: defaultAttachmentInterface.nominalThreadDiameter,
  attachmentThreadPitch: defaultAttachmentInterface.threadPitch,
  attachmentThreadLength: defaultAttachmentInterface.threadLength,
  attachmentThreadClearance: defaultAttachmentInterface.threadClearance,
  attachmentThreadDirection: defaultAttachmentInterface.threadDirection,
  attachmentSeatOuterDiameter: defaultAttachmentInterface.seatOuterDiameter,
  attachmentSeatInnerDiameter: defaultAttachmentInterface.seatInnerDiameter,
  attachmentFlangeThickness: defaultAttachmentInterface.flangeThickness,
  attachmentFlangeRadialClearance: defaultAttachmentInterface.flangeRadialClearance,
  attachmentNeckHeight: defaultAttachmentInterface.neckHeight,
  attachmentRingHeight: defaultAttachmentInterface.ringHeight,
  attachmentRingWallThickness: defaultAttachmentInterface.ringWallThickness,
  transitionType: 'smooth',
  transitionHeight: 0,
  blendHeight: 22,
  decorativeStartRadius: 0,
  transitionStartRadius: 0,
  transitionEndRadius: 0,
  supportType: 'annular',
  supportInset: 10,
  supportThickness: 2,
  hubOuterDiameter: 46,
  hubHeight: 12,
  hubWallThickness: 2,
  taperBottomScale: 1,
  taperTopScale: 1,
  taperEnabled: true,
  waveEnabled: true,
  twistEnabled: true,
  bulgeEnabled: true,
  verticalWaveEnabled: true,
  waves: 12,
  waveAmplitude: 8,
  wavePhase: 0,
  twist: 45,
  bulgeAmount: 0,
  bulgeCenter: 0.5,
  bulgeWidth: 0.35,
  verticalWaveCount: 0,
  verticalWaveAmplitude: 0,
  verticalWavePhase: 0,
  verticalSegments: 100,
  radialSegments: 128,
}

const createWaveLampRequest = (parameters: WaveLampParameterValues): GeometryRequest => ({
  backend: 'procedural',
  operation: 'wave-lamp',
  parameters,
})

function validateWaveLamp(parameters: WaveLampParameterValues): ValidationResult {
  const errors: string[] = []
  const height = Number(parameters.height)
  const bottomDiameter = Number(parameters.bottomDiameter)
  const topDiameter = Number(parameters.topDiameter)
  const wallThickness = Number(parameters.wallThickness)
  const waves = Number(parameters.waves)
  const waveAmplitude = Number(parameters.waveAmplitude)
  const wavePhase = Number(parameters.wavePhase)
  const twist = Number(parameters.twist)
  const bulgeAmount = Number(parameters.bulgeAmount)
  const bulgeCenter = Number(parameters.bulgeCenter)
  const bulgeWidth = Number(parameters.bulgeWidth)
  const verticalWaveCount = Number(parameters.verticalWaveCount)
  const verticalWaveAmplitude = Number(parameters.verticalWaveAmplitude)
  const verticalWavePhase = Number(parameters.verticalWavePhase)
  const taperBottomScale = Number(parameters.taperBottomScale)
  const taperTopScale = Number(parameters.taperTopScale)
  const taperEnabled = parameters.taperEnabled !== false
  const waveEnabled = parameters.waveEnabled !== false
  const bulgeEnabled = parameters.bulgeEnabled !== false
  const verticalWaveEnabled = parameters.verticalWaveEnabled !== false
  const verticalSegments = Number(parameters.verticalSegments)
  const radialSegments = Number(parameters.radialSegments)
  const mountType = String(parameters.mountType ?? 'none')
  const transitionType = String(parameters.transitionType ?? 'smooth')
  const shadeBottomRadius = bottomDiameter / 2

  if (mountType !== 'none' && mountType !== 'generic-threaded') {
    errors.push('Mount type must be None or Generic Threaded.')
  }
  if (mountType === 'generic-threaded') {
    const attachment = resolveAttachmentInterface(parameters)
    const mountBody: MountBodyParameters = {
      outerDiameter: Number(parameters.mountOuterDiameter),
      innerDiameter: Number(parameters.mountInnerDiameter),
      height: Number(parameters.mountHeight),
      wallThickness: Number(parameters.mountWallThickness),
      cableHoleDiameter: Number(parameters.mountCableHoleDiameter),
    }
    const genericMount = deriveMountParameters(mountBody, attachment)
    const retainingRing = deriveRetainingRingParameters(attachment, {
      gripStyle: String(parameters.retainingRingGripStyle) as RetainingRingGripParameters['gripStyle'],
      gripDepth: Number(parameters.retainingRingGripDepth),
      gripCount: Number(parameters.retainingRingGripCount),
    })
    errors.push(...validateAttachmentInterface(attachment, mountBody).errors)
    errors.push(...validateGenericThreadedMount(genericMount).errors)
    errors.push(...validateRetainingRing(retainingRing).errors)
    errors.push(...validateThreadedHub({
      hubOuterDiameter: Number(parameters.hubOuterDiameter),
      hubHeight: Number(parameters.hubHeight),
      hubWallThickness: Number(parameters.hubWallThickness),
      threadDiameter: attachment.nominalThreadDiameter,
      threadPitch: attachment.threadPitch,
      threadLength: attachment.threadLength,
      threadClearance: attachment.threadClearance,
      threadDirection: attachment.threadDirection,
      radialSegments,
    }).errors)
    const supportInset = Number(parameters.supportInset)
    const supportThickness = Number(parameters.supportThickness)
    errors.push(...validateInternalShadeSupport({
      supportType: String(parameters.supportType ?? 'annular') as InternalShadeSupportType,
      supportInset,
      supportThickness,
      hubOuterDiameter: Number(parameters.hubOuterDiameter),
      shadeWallThickness: wallThickness,
      radialSegments,
    }).errors)
    if (Number.isFinite(height) && Number.isFinite(supportInset) && supportInset >= height) {
      errors.push('Internal Shade Support inset must remain inside the decorative shade height.')
    }
    if (Number.isFinite(height) && Number.isFinite(supportInset) && Number.isFinite(supportThickness)
      && supportInset + supportThickness > height) {
      errors.push('Internal Shade Support thickness must remain inside the decorative shade height.')
    }

    if (!genericMount.supportLipEnabled) errors.push('Mounted Wave Lamp requires the Mount Seat/support lip to be enabled.')
    if (Number.isFinite(retainingRing.outerDiameter) && Number.isFinite(genericMount.outerDiameter)
      && retainingRing.outerDiameter > genericMount.outerDiameter + FRAME_TOLERANCE) {
      errors.push('Retaining ring outer diameter must fit within the mount body.')
    }
    if (genericMount.threadDirection !== retainingRing.threadDirection) {
      errors.push('Retaining ring internal thread direction must match the mount external thread direction.')
    }
    if (Number.isFinite(genericMount.threadDiameter) && Number.isFinite(retainingRing.threadDiameter)
      && Math.abs(genericMount.threadDiameter - retainingRing.threadDiameter) > FRAME_TOLERANCE) {
      errors.push('Retaining ring internal thread diameter must match the mount external thread diameter.')
    }
    if (Number.isFinite(genericMount.threadPitch) && Number.isFinite(retainingRing.threadPitch)
      && Math.abs(genericMount.threadPitch - retainingRing.threadPitch) > FRAME_TOLERANCE) {
      errors.push('Retaining ring internal thread pitch must match the mount external thread pitch.')
    }
    if (Number.isFinite(genericMount.supportLipZ) && Number.isFinite(genericMount.threadLength)
      && Number.isFinite(genericMount.height) && Number.isFinite(attachment.flangeThickness)
      && Number.isFinite(retainingRing.threadLength)) {
      const mountThreadStart = genericMount.height - genericMount.threadLength
      const ringThreadStart = genericMount.supportLipZ + attachment.flangeThickness
      const engagement = Math.min(genericMount.height, ringThreadStart + retainingRing.threadLength)
        - Math.max(mountThreadStart, ringThreadStart)
      if (engagement < Math.max(genericMount.threadPitch, retainingRing.threadPitch)) {
        errors.push(`Thread engagement is insufficient: ${Math.max(0, engagement)} mm is less than one thread pitch.`)
      }
    }
  } else {
    const transitionHeight = Number(parameters.transitionHeight ?? 0)
    const blendHeight = Number(parameters.blendHeight ?? 22)
    const requestedDecorativeStart = Number(parameters.decorativeStartRadius ?? 0)
    const requestedTransitionStart = Number(parameters.transitionStartRadius ?? 0)
    const requestedTransitionEnd = Number(parameters.transitionEndRadius ?? 0)
    if (!Number.isFinite(blendHeight) || blendHeight <= 0 || blendHeight > 300) {
      errors.push('Blend height must be greater than zero and at most 300 mm.')
    }
    if (!Number.isFinite(requestedDecorativeStart) || requestedDecorativeStart < 0) {
      errors.push('Decorative start radius cannot be negative.')
    }
    if (!['straight', 'linear-flare', 'smooth'].includes(transitionType)) {
      errors.push('Transition type must be Straight, Linear Flare, or Smooth.')
    }
    errors.push(...validateTransition({
      height: transitionHeight,
      startRadius: requestedTransitionStart,
      endRadius: requestedTransitionEnd,
    }).errors)
    const transitionStartRadius = Number.isFinite(requestedTransitionStart) && requestedTransitionStart > 0
      ? requestedTransitionStart
      : shadeBottomRadius
    if (!Number.isFinite(transitionStartRadius) || transitionStartRadius <= 0) {
      errors.push('Transition start radius must produce a positive radius.')
    } else if (Number.isFinite(wallThickness) && transitionStartRadius <= wallThickness) {
      errors.push('Transition start radius must be greater than shade wall thickness.')
    }
  }

  if (!Number.isFinite(height) || height < 50 || height > 500) errors.push('Height must be between 50 and 500 mm.')
  if (!Number.isFinite(bottomDiameter) || bottomDiameter < 40 || bottomDiameter > 400) {
    errors.push('Bottom diameter must be between 40 and 400 mm.')
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
  if (!Number.isFinite(wavePhase) || wavePhase < -360 || wavePhase > 360) {
    errors.push('Wave phase must be between -360 and 360 degrees.')
  }
  if (!Number.isFinite(twist) || twist < -360 || twist > 360) errors.push('Twist must be between -360 and 360 degrees.')
  if (!Number.isFinite(bulgeAmount) || bulgeAmount < -80 || bulgeAmount > 80) {
    errors.push('Bulge amount must be between -80 and 80 mm.')
  }
  if (!Number.isFinite(bulgeCenter) || bulgeCenter < 0 || bulgeCenter > 1) {
    errors.push('Bulge center must be between 0 and 1.')
  }
  if (!Number.isFinite(bulgeWidth) || bulgeWidth <= 0 || bulgeWidth > 1) {
    errors.push('Bulge deformer width must be non-zero and at most 1.')
  }
  if (!Number.isInteger(verticalWaveCount) || verticalWaveCount < 0 || verticalWaveCount > 64) {
    errors.push('Vertical wave count must be an integer between 0 and 64.')
  }
  if (!Number.isFinite(verticalWaveAmplitude) || verticalWaveAmplitude < 0 || verticalWaveAmplitude > 40) {
    errors.push('Vertical wave amplitude must be between 0 and 40 mm.')
  }
  if (!Number.isFinite(verticalWavePhase) || verticalWavePhase < -360 || verticalWavePhase > 360) {
    errors.push('Vertical wave phase must be between -360 and 360 degrees.')
  }
  if (!Number.isFinite(taperBottomScale) || taperBottomScale < 0.1 || taperBottomScale > 4) {
    errors.push('Taper bottom scale must be between 0.1 and 4.')
  }
  if (!Number.isFinite(taperTopScale) || taperTopScale < 0.1 || taperTopScale > 4) {
    errors.push('Taper top scale must be between 0.1 and 4.')
  }
  if (!Number.isInteger(verticalSegments) || verticalSegments < 20 || verticalSegments > 300) {
    errors.push('Vertical segments must be an integer between 20 and 300.')
  }
  if (!Number.isInteger(radialSegments) || radialSegments < 32 || radialSegments > 512) {
    errors.push('Radial segments must be an integer between 32 and 512.')
  }

  if (Number.isFinite(bottomDiameter) && Number.isFinite(wallThickness) && bottomDiameter <= wallThickness * 2) {
    errors.push('Bottom diameter must be greater than twice the wall thickness.')
  }
  if (Number.isFinite(topDiameter) && Number.isFinite(wallThickness) && topDiameter <= wallThickness * 2) {
    errors.push('Top diameter must be greater than twice the wall thickness.')
  }
  const minimumTaperRadius = Math.min(
    shadeBottomRadius * (taperEnabled ? taperBottomScale : 1),
    topDiameter * (taperEnabled ? taperTopScale : 1) / 2,
  )
  const minimumAfterWave = minimumTaperRadius - (waveEnabled ? Math.abs(waveAmplitude) : 0)
  const minimumAfterBulge = minimumAfterWave + (bulgeEnabled ? Math.min(0, bulgeAmount) : 0)
  const minimumFinalRadius = minimumAfterBulge - (verticalWaveEnabled ? Math.abs(verticalWaveAmplitude) : 0)

  if (Number.isFinite(minimumAfterWave) && minimumAfterWave <= 0) {
    errors.push('Wave deformer would produce a non-positive final radius.')
  } else if (Number.isFinite(minimumAfterWave) && Number.isFinite(wallThickness) && minimumAfterWave <= wallThickness) {
    errors.push('Wave deformer would collapse the inner surface; reduce wave amplitude.')
  }
  if (Number.isFinite(minimumAfterBulge) && minimumAfterBulge <= 0) {
    errors.push('Bulge deformer would produce a non-positive final radius.')
  } else if (Number.isFinite(minimumAfterBulge) && Number.isFinite(wallThickness) && minimumAfterBulge <= wallThickness) {
    errors.push('Bulge deformer would collapse the inner surface; reduce bulge amount.')
  }
  if (Number.isFinite(minimumFinalRadius) && minimumFinalRadius <= 0) {
    errors.push('Vertical Wave deformer would produce a non-positive final radius.')
  } else if (Number.isFinite(minimumFinalRadius) && Number.isFinite(wallThickness) && minimumFinalRadius <= wallThickness) {
    errors.push('Vertical Wave deformer would collapse the inner surface; reduce vertical wave amplitude.')
  }
  if (!Number.isFinite(minimumFinalRadius)) errors.push('Deformer pipeline produced a NaN or Infinity radius.')

  return { valid: errors.length === 0, errors }
}

function quantize(value: number, step: number, min: number, max: number): number {
  const clamped = Math.min(max, Math.max(min, value))
  return Math.round((clamped - min) / step) * step + min
}

function randomizeWaveLamp(parameters: WaveLampParameterValues, random = Math.random): WaveLampParameterValues {
  const wallThickness = Number(parameters.wallThickness)
  const bottomDiameter = Math.round(80 + random() * 220)
  const topDiameter = Math.round(70 + random() * 200)
  const minimumRadius = Math.min(bottomDiameter, topDiameter) / 2
  const maximumAmplitude = Math.min(40, Math.max(0, minimumRadius - wallThickness - 1))

  return {
    ...parameters,
    height: Math.round(120 + random() * 240),
    bottomDiameter,
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
