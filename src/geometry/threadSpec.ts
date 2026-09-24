import type { ValidationResult } from '../parametric/types'

export type ThreadHandedness = 'right' | 'left'
export type ThreadProfileType = 'metric-like triangular'

export interface ThreadSpec {
  nominalDiameter: number
  pitch: number
  length: number
  depth: number
  clearance: number
  handedness: ThreadHandedness
  profileType: ThreadProfileType
}

export interface LegacyThreadValues {
  nominalDiameter: number
  pitch: number
  length?: number
  depth?: number
  clearance?: number
  handedness?: ThreadHandedness
  profileType?: ThreadProfileType
}

export function validateThreadSpec(spec: ThreadSpec): ValidationResult {
  const errors: string[] = []
  if (!Number.isFinite(spec.nominalDiameter) || spec.nominalDiameter <= 0) {
    errors.push('Thread nominal diameter must be greater than zero.')
  }
  if (!Number.isFinite(spec.pitch) || spec.pitch <= 0) errors.push('Thread pitch must be greater than zero.')
  if (!Number.isFinite(spec.length) || spec.length <= 0) errors.push('Thread length must be greater than zero.')
  if (!Number.isFinite(spec.depth) || spec.depth <= 0) errors.push('Thread depth must be greater than zero.')
  if (!Number.isFinite(spec.clearance) || spec.clearance < 0) errors.push('Thread clearance cannot be negative.')
  if (spec.handedness !== 'right' && spec.handedness !== 'left') {
    errors.push('Thread handedness must be right or left.')
  }
  if (spec.profileType !== 'metric-like triangular') {
    errors.push('Thread profile type must be metric-like triangular.')
  }
  if (Number.isFinite(spec.length) && Number.isFinite(spec.pitch) && spec.length < spec.pitch) {
    errors.push('Thread length must contain at least one pitch.')
  }
  if (Number.isFinite(spec.depth) && Number.isFinite(spec.pitch) && spec.depth >= spec.pitch / 2) {
    errors.push('Thread depth must be less than half the pitch.')
  }
  if (Number.isFinite(spec.depth) && Number.isFinite(spec.nominalDiameter) && spec.depth >= spec.nominalDiameter / 2) {
    errors.push('Thread depth must be less than the nominal radius.')
  }
  if (Number.isFinite(spec.clearance) && Number.isFinite(spec.pitch) && spec.clearance > spec.pitch / 2) {
    errors.push('Thread clearance is too large for the selected pitch.')
  }
  if (Number.isFinite(spec.clearance) && Number.isFinite(spec.nominalDiameter)
    && spec.nominalDiameter / 2 + spec.clearance + spec.depth <= 0) {
    errors.push('Thread clearance and depth leave no printable female thread radius.')
  }
  return { valid: errors.length === 0, errors }
}

export function createThreadSpec(input: ThreadSpec): ThreadSpec {
  const spec: ThreadSpec = { ...input }
  const validation = validateThreadSpec(spec)
  if (!validation.valid) throw new Error(validation.errors.join(' '))
  return spec
}

export function deriveThreadTurns(spec: ThreadSpec): number {
  return spec.length / spec.pitch
}

export function threadSpecFromLegacy(values: LegacyThreadValues): ThreadSpec {
  return createThreadSpec({
    nominalDiameter: Number(values.nominalDiameter),
    pitch: Number(values.pitch),
    length: Number(values.length ?? values.pitch * 6),
    depth: Number(values.depth ?? Math.min(values.pitch / 4, values.nominalDiameter / 16)),
    clearance: Number(values.clearance ?? 0),
    handedness: values.handedness ?? 'right',
    profileType: values.profileType ?? 'metric-like triangular',
  })
}
