export interface DeformerVertex {
  normalizedHeight: number
  angle: number
  radius: number
  deformationWeight?: number
  x?: number
  y?: number
  z?: number
}

export interface Deformer<P extends object = object> {
  id: string
  name: string
  enabled: boolean
  parameters: P
  apply(vertex: DeformerVertex): void
}

export interface TaperParameters {
  bottomScale: number
  topScale: number
}

export interface WaveParameters {
  count: number
  amplitude: number
  phase: number
}

export interface TwistParameters {
  degrees: number
}

export interface BulgeParameters {
  amount: number
  center: number
  width: number
}

export interface VerticalWaveParameters {
  count: number
  amplitude: number
  phase: number
}

export interface WaveLampDeformerParameters {
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
  taperEnabled?: boolean
  waveEnabled?: boolean
  twistEnabled?: boolean
  bulgeEnabled?: boolean
  verticalWaveEnabled?: boolean
}

const degreesToRadians = (degrees: number): number => (degrees * Math.PI) / 180

export function createTaperDeformer(parameters: TaperParameters, enabled = true): Deformer<TaperParameters> {
  return {
    id: 'taper',
    name: 'Taper',
    enabled,
    parameters,
    apply(vertex) {
      const scale = parameters.bottomScale
        + (parameters.topScale - parameters.bottomScale) * vertex.normalizedHeight
      vertex.radius *= 1 + (scale - 1) * (vertex.deformationWeight ?? 1)
    },
  }
}

export function createWaveDeformer(parameters: WaveParameters, enabled = true): Deformer<WaveParameters> {
  const phaseRadians = degreesToRadians(parameters.phase)
  return {
    id: 'wave',
    name: 'Wave',
    enabled,
    parameters,
    apply(vertex) {
      vertex.radius += Math.sin(vertex.angle * parameters.count + phaseRadians)
        * parameters.amplitude
        * (vertex.deformationWeight ?? 1)
    },
  }
}

export function createTwistDeformer(parameters: TwistParameters, enabled = true): Deformer<TwistParameters> {
  const twistRadians = degreesToRadians(parameters.degrees)
  return {
    id: 'twist',
    name: 'Twist',
    enabled,
    parameters,
    apply(vertex) {
      vertex.angle += twistRadians * vertex.normalizedHeight * (vertex.deformationWeight ?? 1)
    },
  }
}

export function createBulgeDeformer(parameters: BulgeParameters, enabled = true): Deformer<BulgeParameters> {
  return {
    id: 'bulge',
    name: 'Bulge',
    enabled,
    parameters,
    apply(vertex) {
      const distance = (vertex.normalizedHeight - parameters.center) / parameters.width
      vertex.radius += parameters.amount * Math.exp(-0.5 * distance * distance) * (vertex.deformationWeight ?? 1)
    },
  }
}

export function createVerticalWaveDeformer(
  parameters: VerticalWaveParameters,
  enabled = true,
): Deformer<VerticalWaveParameters> {
  const phaseRadians = degreesToRadians(parameters.phase)
  return {
    id: 'vertical-wave',
    name: 'Vertical Wave',
    enabled,
    parameters,
    apply(vertex) {
      vertex.radius += Math.sin(vertex.normalizedHeight * parameters.count * Math.PI * 2 + phaseRadians)
        * parameters.amplitude
        * (vertex.deformationWeight ?? 1)
    },
  }
}

export function createWaveLampDeformers(parameters: WaveLampDeformerParameters): readonly Deformer[] {
  return [
    createTaperDeformer({
      bottomScale: parameters.taperBottomScale,
      topScale: parameters.taperTopScale,
    }, parameters.taperEnabled !== false),
    createWaveDeformer({
      count: parameters.waves,
      amplitude: parameters.waveAmplitude,
      phase: parameters.wavePhase,
    }, parameters.waveEnabled !== false),
    createTwistDeformer({ degrees: parameters.twist }, parameters.twistEnabled !== false),
    createBulgeDeformer({
      amount: parameters.bulgeAmount,
      center: parameters.bulgeCenter,
      width: parameters.bulgeWidth,
    }, parameters.bulgeEnabled !== false),
    createVerticalWaveDeformer({
      count: parameters.verticalWaveCount,
      amplitude: parameters.verticalWaveAmplitude,
      phase: parameters.verticalWavePhase,
    }, parameters.verticalWaveEnabled !== false),
  ]
}

function assertFiniteVertex(vertex: DeformerVertex, deformerName: string): void {
  if (!Number.isFinite(vertex.normalizedHeight)
    || !Number.isFinite(vertex.angle)
    || !Number.isFinite(vertex.radius)
    || (vertex.deformationWeight !== undefined && !Number.isFinite(vertex.deformationWeight))
    || (vertex.x !== undefined && !Number.isFinite(vertex.x))
    || (vertex.y !== undefined && !Number.isFinite(vertex.y))
    || (vertex.z !== undefined && !Number.isFinite(vertex.z))) {
    throw new Error(`Deformer "${deformerName}" produced a non-finite vertex.`)
  }
}

export function applyDeformers(vertex: DeformerVertex, deformers: readonly Deformer[]): string {
  let lastAppliedName = 'pipeline'
  for (let index = 0; index < deformers.length; index += 1) {
    const deformer = deformers[index]
    if (!deformer.enabled) continue
    deformer.apply(vertex)
    lastAppliedName = deformer.name
    assertFiniteVertex(vertex, deformer.name)
  }

  if (!Number.isFinite(vertex.radius) || vertex.radius <= 0) {
    throw new Error(`Deformer "${lastAppliedName}" produced a non-positive final radius.`)
  }
  return lastAppliedName
}
