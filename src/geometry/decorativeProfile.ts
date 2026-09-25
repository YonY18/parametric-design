import type { ParameterValues } from '../parametric/types'

export type SilhouettePreset = 'cylinder' | 'bell' | 'vase' | 'hourglass' | 'rounded' | 'cone'
export type SurfacePatternType = 'smooth' | 'soft-waves' | 'ribs' | 'pleats' | 'scallops'
export type PatternAmplitudeMode = 'mm' | 'percent'
export type TwistProfile = 'linear' | 'ease-in-out'

export interface DecorativeProfileParameters extends ParameterValues {
  height: number
  bottomDiameter: number
  topDiameter: number
  wallThickness: number
  lowerBulge: number
  waist: number
  upperBulge: number
  silhouetteSmoothness: number
  silhouettePreset: SilhouettePreset
  patternType: SurfacePatternType
  patternCount: number
  patternAmplitude: number
  amplitudeMode: PatternAmplitudeMode
  patternPhase: number
  patternStart: number
  patternFullAt: number
  patternFadeOut: number
  bottomPatternFade: number
  topPatternFade: number
  twistAngle: number
  twistProfile: TwistProfile
  showBaseSilhouette: boolean
  disablePattern: boolean
  disableTwist: boolean
}

export interface DecorativeProfilePoint {
  angle: number
  radius: number
  innerRadius: number
  baseRadius: number
}

function numeric(parameters: ParameterValues, id: string, fallback = 0, aliases: readonly string[] = []): number {
  const value = parameters[id] ?? aliases.map((alias) => parameters[alias]).find((candidate) => candidate !== undefined)
  const candidate = Number(value)
  return Number.isFinite(candidate) ? candidate : fallback
}

function choice(parameters: ParameterValues, id: string, fallback: string, aliases: readonly string[] = []): string {
  const value = parameters[id] ?? aliases.map((alias) => parameters[alias]).find((candidate) => candidate !== undefined)
  return String(value ?? fallback).trim().toLowerCase().replace(/[\s_]+/g, '-')
}

export function smootherstep(value: number): number {
  const t = Math.min(1, Math.max(0, value))
  return t * t * t * (t * (t * 6 - 15) + 10)
}

/** Returns zero at the collar and one at the end of the lower adaptation zone. */
export function bottomAdaptationEnvelope(normalizedHeight: number, adaptationHeight: number): number {
  if (!Number.isFinite(adaptationHeight) || adaptationHeight <= 0) return normalizedHeight > 0 ? 1 : 0
  return smootherstep(normalizedHeight / adaptationHeight)
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t
  const t3 = t2 * t
  return 0.5 * ((2 * p1)
    + (-p0 + p2) * t
    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
    + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
}

interface SilhouetteFactors {
  lower: number
  waist: number
  upper: number
  minimum: number
}

const silhouetteFactors: Record<SilhouettePreset, SilhouetteFactors> = {
  cylinder: { lower: 1, waist: 1, upper: 1, minimum: 0.98 },
  bell: { lower: 1.04, waist: 1.08, upper: 1.14, minimum: 1 },
  vase: { lower: 1.03, waist: 0.78, upper: 1.05, minimum: 0.78 },
  hourglass: { lower: 0.96, waist: 0.68, upper: 0.96, minimum: 0.68 },
  rounded: { lower: 1.04, waist: 1.1, upper: 1.04, minimum: 1 },
  cone: { lower: 1, waist: 0.98, upper: 0.96, minimum: 0.94 },
}

export function baseSilhouetteRadius(parameters: ParameterValues, normalizedHeight: number): number {
  const t = Math.min(1, Math.max(0, normalizedHeight))
  const bottomRadius = numeric(parameters, 'bottomDiameter', 0, ['maxDiameter']) / 2
  const topRadius = numeric(parameters, 'topDiameter') / 2
  const presetName = choice(parameters, 'silhouettePreset', 'cylinder') as SilhouettePreset
  const factors = silhouetteFactors[presetName] ?? silhouetteFactors.cylinder
  const lower = bottomRadius * factors.lower * numeric(parameters, 'lowerBulge', 1)
  const waist = ((bottomRadius + topRadius) / 2) * factors.waist * numeric(parameters, 'waist', 1)
  const upper = topRadius * factors.upper * numeric(parameters, 'upperBulge', 1)
  const points = [bottomRadius, lower, waist, upper, topRadius]
  const scaled = t * 4
  const index = Math.min(3, Math.floor(scaled))
  const local = scaled - index
  const smoothness = Math.min(1, Math.max(0, numeric(parameters, 'silhouetteSmoothness', 0.8)))
  const curved = catmullRom(
    points[Math.max(0, index - 1)],
    points[index],
    points[index + 1],
    points[Math.min(4, index + 2)],
    local,
  )
  const linear = points[index] + (points[index + 1] - points[index]) * local
  return Math.max(0.1, linear + (curved - linear) * smoothness)
}

export function patternEnvelope(parameters: ParameterValues, normalizedHeight: number): number {
  const t = Math.min(1, Math.max(0, normalizedHeight))
  const start = Math.min(1, Math.max(0, numeric(parameters, 'patternStart', 0)))
  const fullAt = Math.min(1, Math.max(start + 0.001, numeric(parameters, 'patternFullAt', 0.08)))
  const fadeOut = Math.min(1, Math.max(fullAt, numeric(parameters, 'patternFadeOut', 1)))
  const bottomFade = Math.max(0, numeric(parameters, 'bottomPatternFade', 0.08))
  const topFade = Math.max(0, numeric(parameters, 'topPatternFade', 0.08))
  const rampIn = smootherstep((t - start) / (fullAt - start))
  const rampOut = fadeOut >= 1 ? 1 : 1 - smootherstep((t - fadeOut) / Math.max(0.001, 1 - fadeOut))
  const circularBottom = bottomFade <= 0 ? (t <= 0 ? 0 : 1) : smootherstep(t / bottomFade)
  const circularTop = topFade <= 0 ? (t >= 1 ? 0 : 1) : smootherstep((1 - t) / topFade)
  return rampIn * rampOut * circularBottom * circularTop
}

function roundedRibWave(x: number): number {
  return Math.pow((1 + Math.cos(x)) / 2, 0.55) * 2 - 1
}

function pleatWave(x: number): number {
  return (2 / Math.PI) * Math.asin(Math.sin(x))
}

function scallopWave(x: number): number {
  return Math.cos(x) * 0.65 + Math.cos(x * 2) * 0.35
}

export function surfacePatternOffset(
  parameters: ParameterValues,
  localBaseRadius: number,
  angle: number,
  normalizedHeight: number,
): number {
  if (parameters.disablePattern === true || parameters.showBaseSilhouette === true) return 0
  const type = choice(parameters, 'patternType', 'soft-waves') as SurfacePatternType
  if (type === 'smooth') return 0
  const count = numeric(parameters, 'waves', 8, ['patternCount'])
  const phase = numeric(parameters, 'patternPhase', 0, ['wavePhase']) * Math.PI / 180
  const rawAmplitude = numeric(parameters, 'amplitude', 5, ['patternAmplitude', 'waveAmplitude'])
  const amplitudeMode = choice(parameters, 'amplitudeMode', 'percent')
  const amplitude = amplitudeMode === 'mm' ? rawAmplitude : localBaseRadius * rawAmplitude / 100
  const x = angle * count + phase
  const wave = type === 'ribs'
    ? roundedRibWave(x)
    : type === 'pleats'
      ? pleatWave(x)
      : type === 'scallops'
        ? scallopWave(x)
        : Math.sin(x)
  return wave * amplitude * patternEnvelope(parameters, normalizedHeight)
}

function twistCurve(parameters: ParameterValues, t: number): number {
  return choice(parameters, 'twistProfile', 'linear') === 'linear' ? t : smootherstep(t)
}

export function twistedProfileAngle(
  parameters: ParameterValues,
  angle: number,
  normalizedHeight: number,
  twistWeight = 1,
): number {
  if (parameters.disableTwist === true) return angle
  return angle + numeric(parameters, 'twist', 0, ['twistAngle']) * Math.PI / 180 * twistCurve(parameters, normalizedHeight) * twistWeight
}

export function createDecorativeProfilePoint(
  parameters: DecorativeProfileParameters,
  normalizedHeight: number,
  angle: number,
  deformationWeight = 1,
  baseRadiusOverride?: number,
  twistWeight = 1,
): DecorativeProfilePoint {
  const baseRadius = baseRadiusOverride ?? baseSilhouetteRadius(parameters, normalizedHeight)
  const radius = baseRadius + surfacePatternOffset(parameters, baseRadius, angle, normalizedHeight) * deformationWeight
  const innerRadius = radius - numeric(parameters, 'wallThickness')
  if (!Number.isFinite(radius) || !Number.isFinite(innerRadius) || innerRadius <= 0) {
    throw new Error('Decorative wall thickness produces a non-positive interior radius.')
  }
  return {
    angle: twistedProfileAngle(parameters, angle, normalizedHeight, twistWeight),
    radius,
    innerRadius,
    baseRadius,
  }
}
