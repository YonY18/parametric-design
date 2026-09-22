import {
  applyDeformers,
  createBulgeDeformer,
  createTaperDeformer,
  createTwistDeformer,
  createVerticalWaveDeformer,
  createWaveDeformer,
  createWaveLampDeformers,
  type DeformerVertex,
} from '../src/geometry/deformers.ts'

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

function assertClose(actual: number, expected: number, message: string): void {
  assert(Math.abs(actual - expected) < 1e-9, `${message}: expected ${expected}, received ${actual}`)
}

function vertex(overrides: Partial<DeformerVertex> = {}): DeformerVertex {
  return { normalizedHeight: 0.5, angle: 0, radius: 10, ...overrides }
}

const taperBottom = vertex({ normalizedHeight: 0 })
applyDeformers(taperBottom, [createTaperDeformer({ bottomScale: 2, topScale: 4 })])
assertClose(taperBottom.radius, 20, 'Taper uses bottomScale at t=0')

const taperTop = vertex({ normalizedHeight: 1 })
applyDeformers(taperTop, [createTaperDeformer({ bottomScale: 2, topScale: 4 })])
assertClose(taperTop.radius, 40, 'Taper uses topScale at t=1')

const wave = vertex({ angle: Math.PI / 2 })
applyDeformers(wave, [createWaveDeformer({ count: 1, amplitude: 2, phase: 0 })])
assertClose(wave.radius, 12, 'Wave adds a circumferential sinusoid')

const waveNoop = vertex({ angle: 1.2 })
applyDeformers(waveNoop, [createWaveDeformer({ count: 4, amplitude: 0, phase: 35 })])
assertClose(waveNoop.radius, 10, 'Wave amplitude 0 does not change radius')

const twistBottom = vertex({ normalizedHeight: 0, angle: 0.25 })
applyDeformers(twistBottom, [createTwistDeformer({ degrees: 360 })])
assertClose(twistBottom.angle, 0.25, 'Twist does not rotate at t=0')

const twistTop = vertex({ normalizedHeight: 1 })
applyDeformers(twistTop, [createTwistDeformer({ degrees: 360 })])
assertClose(twistTop.angle, Math.PI * 2, 'Twist applies the full rotation at t=1')

const bulgeNoop = vertex({ normalizedHeight: 0.5 })
applyDeformers(bulgeNoop, [createBulgeDeformer({ amount: 0, center: 0.5, width: 0.25 })])
assertClose(bulgeNoop.radius, 10, 'Bulge amount 0 does not change radius')

const bulgeCenter = vertex({ normalizedHeight: 0.5 })
const bulgeAway = vertex({ normalizedHeight: 0 })
const bulge = createBulgeDeformer({ amount: 5, center: 0.5, width: 0.25 })
applyDeformers(bulgeCenter, [bulge])
applyDeformers(bulgeAway, [bulge])
assertClose(bulgeCenter.radius, 15, 'Bulge peaks at its center')
assert(bulgeCenter.radius > bulgeAway.radius, 'Bulge is smaller away from its center')

const verticalWaveNoop = vertex({ normalizedHeight: 0.125 })
applyDeformers(verticalWaveNoop, [createVerticalWaveDeformer({ count: 2, amplitude: 0, phase: 90 })])
assertClose(verticalWaveNoop.radius, 10, 'Vertical Wave amplitude 0 does not change radius')

const disabled = vertex({ angle: 0 })
const disabledWave = createWaveDeformer({ count: 1, amplitude: 10, phase: 90 }, false)
applyDeformers(disabled, [disabledWave])
assertClose(disabled.radius, 10, 'Disabled deformers do not affect radius')
assertClose(disabled.angle, 0, 'Disabled deformers do not affect angle')

const configuredParameters = {
  waves: 1,
  waveAmplitude: 1,
  wavePhase: 0,
  twist: 1,
  bulgeAmount: 1,
  bulgeCenter: 0.5,
  bulgeWidth: 0.5,
  verticalWaveCount: 1,
  verticalWaveAmplitude: 1,
  verticalWavePhase: 0,
  taperBottomScale: 2,
  taperTopScale: 4,
  taperEnabled: false,
  waveEnabled: false,
  twistEnabled: false,
  bulgeEnabled: false,
  verticalWaveEnabled: false,
}
const configured = createWaveLampDeformers(configuredParameters)
assert(configured.every((deformer) => !deformer.enabled), 'Wave Lamp passes disabled deformers to the pipeline')
const disabledTaper = vertex({ normalizedHeight: 1 })
applyDeformers(disabledTaper, configured)
assertClose(disabledTaper.radius, 10, 'Disabled Wave Lamp Taper is a no-op')

const scaledTaper = vertex({ normalizedHeight: 1 })
const enabledTaper = createWaveLampDeformers({ ...configuredParameters, taperEnabled: true })
applyDeformers(scaledTaper, [enabledTaper[0]])
assertClose(scaledTaper.radius, 40, 'Wave Lamp forwards Taper scales to the deformer')

const ordered = vertex({ normalizedHeight: 0.5, angle: 0 })
applyDeformers(ordered, [
  createTwistDeformer({ degrees: 180 }),
  createWaveDeformer({ count: 1, amplitude: 2, phase: 0 }),
])
assertClose(ordered.radius, 12, 'Pipeline applies deformers in array order')

const reverseOrder = vertex({ normalizedHeight: 0.5, angle: 0 })
applyDeformers(reverseOrder, [
  createWaveDeformer({ count: 1, amplitude: 2, phase: 0 }),
  createTwistDeformer({ degrees: 180 }),
])
assertClose(reverseOrder.radius, 10, 'Pipeline order changes the observed result')

console.log('Deformer tests passed.')
