import type { ParameterValues, ValidationResult } from '../parametric/types'
import type { GenericThreadedMountParameters } from './mounts'
import type { RetainingGripStyle, RetainingRingParameters } from './retainingRing'
import type { ShadeNeckParameters } from './shadeNeck'
import type { ThreadDirection } from './threadFeature'

export interface AttachmentInterface extends ParameterValues {
  nominalThreadDiameter: number
  threadPitch: number
  threadLength: number
  threadClearance: number
  seatOuterDiameter: number
  seatInnerDiameter: number
  flangeThickness: number
  flangeRadialClearance: number
  neckHeight: number
  ringHeight: number
  ringWallThickness: number
  threadDirection: ThreadDirection
}

export const defaultAttachmentInterface: AttachmentInterface = {
  nominalThreadDiameter: 40,
  threadPitch: 2,
  threadLength: 12,
  threadClearance: 0.2,
  seatOuterDiameter: 60,
  seatInnerDiameter: 42,
  flangeThickness: 2,
  flangeRadialClearance: 2,
  neckHeight: 8,
  ringHeight: 12,
  ringWallThickness: 4,
  threadDirection: 'right',
}

function value(parameters: ParameterValues, keys: readonly string[], fallback: number): number {
  for (const key of keys) {
    if (parameters[key] !== undefined) return Number(parameters[key])
  }
  return fallback
}

function text(parameters: ParameterValues, keys: readonly string[], fallback: ThreadDirection): ThreadDirection {
  for (const key of keys) {
    if (parameters[key] !== undefined) return String(parameters[key]) as ThreadDirection
  }
  return fallback
}

/** Resolve the public interface fields, with one-way support for pre-interface parameter names. */
export function resolveAttachmentInterface(parameters: ParameterValues): AttachmentInterface {
  return {
    nominalThreadDiameter: value(parameters, ['attachmentThreadDiameter', 'mountThreadDiameter', 'retainingRingThreadDiameter'], defaultAttachmentInterface.nominalThreadDiameter),
    threadPitch: value(parameters, ['attachmentThreadPitch', 'mountThreadPitch', 'retainingRingThreadPitch'], defaultAttachmentInterface.threadPitch),
    threadLength: value(parameters, ['attachmentThreadLength', 'mountThreadLength', 'retainingRingThreadLength'], defaultAttachmentInterface.threadLength),
    threadClearance: value(parameters, ['attachmentThreadClearance', 'mountThreadClearance', 'retainingRingThreadClearance'], defaultAttachmentInterface.threadClearance),
    seatOuterDiameter: value(parameters, ['attachmentSeatOuterDiameter', 'mountSupportLipOuterDiameter', 'shadeFlangeOuterDiameter'], defaultAttachmentInterface.seatOuterDiameter),
    seatInnerDiameter: value(parameters, ['attachmentSeatInnerDiameter', 'mountSupportLipInnerDiameter', 'shadeFlangeInnerDiameter'], defaultAttachmentInterface.seatInnerDiameter),
    flangeThickness: value(parameters, ['attachmentFlangeThickness', 'shadeFlangeThickness', 'mountSupportLipThickness'], defaultAttachmentInterface.flangeThickness),
    flangeRadialClearance: value(parameters, ['attachmentFlangeRadialClearance', 'shadeSeatClearance'], defaultAttachmentInterface.flangeRadialClearance),
    neckHeight: value(parameters, ['attachmentNeckHeight', 'shadeNeckHeight'], defaultAttachmentInterface.neckHeight),
    ringHeight: value(parameters, ['attachmentRingHeight', 'retainingRingHeight'], defaultAttachmentInterface.ringHeight),
    ringWallThickness: value(parameters, ['attachmentRingWallThickness', 'retainingRingWallThickness'], defaultAttachmentInterface.ringWallThickness),
    threadDirection: text(parameters, ['attachmentThreadDirection', 'mountThreadDirection', 'retainingRingThreadDirection'], defaultAttachmentInterface.threadDirection),
  }
}

export interface MountBodyParameters extends ParameterValues {
  outerDiameter: number
  innerDiameter: number
  height: number
  wallThickness: number
  cableHoleDiameter: number
}

export interface RetainingRingGripParameters extends ParameterValues {
  gripStyle: RetainingGripStyle
  gripDepth: number
  gripCount: number
}

export function validateAttachmentInterface(attachment: AttachmentInterface, mount?: MountBodyParameters): ValidationResult {
  const errors: string[] = []
  const values = {
    nominalThreadDiameter: Number(attachment.nominalThreadDiameter),
    threadPitch: Number(attachment.threadPitch),
    threadLength: Number(attachment.threadLength),
    threadClearance: Number(attachment.threadClearance),
    seatOuterDiameter: Number(attachment.seatOuterDiameter),
    seatInnerDiameter: Number(attachment.seatInnerDiameter),
    flangeThickness: Number(attachment.flangeThickness),
    flangeRadialClearance: Number(attachment.flangeRadialClearance),
    neckHeight: Number(attachment.neckHeight),
    ringHeight: Number(attachment.ringHeight),
    ringWallThickness: Number(attachment.ringWallThickness),
  }

  if (!Number.isFinite(values.nominalThreadDiameter) || values.nominalThreadDiameter <= 0) errors.push('Attachment nominal thread diameter must be greater than zero.')
  if (!Number.isFinite(values.threadPitch) || values.threadPitch <= 0) errors.push('Attachment thread pitch must be greater than zero.')
  if (!Number.isFinite(values.threadLength) || values.threadLength <= 0) errors.push('Attachment thread length must be greater than zero.')
  if (!Number.isFinite(values.threadClearance) || values.threadClearance < 0) errors.push('Attachment thread clearance cannot be negative.')
  if (!Number.isFinite(values.seatOuterDiameter) || values.seatOuterDiameter <= 0) errors.push('Attachment seat outer diameter must be greater than zero.')
  if (!Number.isFinite(values.seatInnerDiameter) || values.seatInnerDiameter <= 0) errors.push('Attachment seat inner diameter must be greater than zero.')
  if (!Number.isFinite(values.flangeThickness) || values.flangeThickness <= 0) errors.push('Attachment flange thickness must be greater than zero.')
  if (!Number.isFinite(values.flangeRadialClearance) || values.flangeRadialClearance < 0) errors.push('Attachment flange radial clearance cannot be negative.')
  if (!Number.isFinite(values.neckHeight) || values.neckHeight <= 0) errors.push('Attachment neck height must be greater than zero.')
  if (!Number.isFinite(values.ringHeight) || values.ringHeight <= 0) errors.push('Attachment retaining ring height must be greater than zero.')
  if (!Number.isFinite(values.ringWallThickness) || values.ringWallThickness <= 0) errors.push('Attachment retaining ring wall thickness must be greater than zero.')
  if (attachment.threadDirection !== 'right' && attachment.threadDirection !== 'left') errors.push('Attachment thread direction must be right or left.')

  const ringInnerDiameter = values.nominalThreadDiameter + values.threadClearance * 2
  const ringOuterDiameter = ringInnerDiameter + values.ringWallThickness * 2
  const flangeInnerDiameter = values.seatInnerDiameter + values.flangeRadialClearance * 2
  const neckOuterDiameter = values.seatInnerDiameter - values.flangeRadialClearance * 2
  const flangeOuterDiameter = Math.min(
    values.seatOuterDiameter - values.flangeRadialClearance * 2,
    ringOuterDiameter - Math.max(0.5, values.flangeRadialClearance * 0.25),
  )

  if (Number.isFinite(values.seatOuterDiameter) && Number.isFinite(values.seatInnerDiameter) && values.seatOuterDiameter <= values.seatInnerDiameter) {
    errors.push('Attachment seat outer diameter must be greater than seat inner diameter.')
  }
  if (Number.isFinite(values.seatInnerDiameter) && Number.isFinite(values.nominalThreadDiameter) && values.seatInnerDiameter < values.nominalThreadDiameter + values.threadClearance * 2) {
    errors.push('Attachment seat inner diameter must clear the thread plus clearance.')
  }
  if (Number.isFinite(flangeOuterDiameter) && Number.isFinite(flangeInnerDiameter) && flangeOuterDiameter <= flangeInnerDiameter) {
    errors.push('Attachment flange radial clearance leaves no flange material.')
  }
  if (Number.isFinite(ringOuterDiameter) && Number.isFinite(ringInnerDiameter)
    && Number.isFinite(values.ringWallThickness)
    && ringOuterDiameter - ringInnerDiameter < values.ringWallThickness * 2) {
    errors.push('Attachment retaining ring wall thickness is too large for the derived ring diameter.')
  }
  if (Number.isFinite(flangeOuterDiameter) && Number.isFinite(values.seatOuterDiameter)
    && flangeOuterDiameter > values.seatOuterDiameter) {
    errors.push('Derived shade flange must fit within the Mount Seat outer diameter.')
  }
  if (Number.isFinite(values.ringHeight) && Number.isFinite(values.flangeThickness) && values.ringHeight < values.flangeThickness) {
    errors.push('Attachment retaining ring height must cover the shade flange thickness.')
  }
  if (Number.isFinite(values.ringHeight) && Number.isFinite(values.threadLength) && values.ringHeight < values.threadLength) {
    errors.push('Attachment retaining ring height must cover the interface thread length.')
  }
  if (Number.isFinite(values.threadClearance) && Number.isFinite(values.threadPitch) && values.threadClearance > values.threadPitch / 2) {
    errors.push('Attachment thread clearance is too large for the selected pitch.')
  }
  if (mount) {
    const mountInnerDiameter = Number(mount.innerDiameter)
    const mountHeight = Number(mount.height)
    const cableHoleDiameter = Number(mount.cableHoleDiameter)
    if (Number.isFinite(mountInnerDiameter) && Number.isFinite(neckOuterDiameter) && mountInnerDiameter >= neckOuterDiameter) {
      errors.push('Mount inner diameter must be smaller than the derived shade neck outer diameter.')
    }
    if (Number.isFinite(cableHoleDiameter) && Number.isFinite(mountInnerDiameter) && cableHoleDiameter >= mountInnerDiameter) {
      errors.push('Cable hole diameter must be smaller than the mount and shade neck opening.')
    }
    if (Number.isFinite(values.threadLength) && Number.isFinite(mountHeight) && values.threadLength > mountHeight) {
      errors.push('Attachment thread length cannot exceed mount height.')
    }
  }

  return { valid: errors.length === 0, errors }
}

export function deriveMountParameters(
  mount: MountBodyParameters,
  attachment: AttachmentInterface,
): GenericThreadedMountParameters {
  return {
    outerDiameter: mount.outerDiameter,
    innerDiameter: mount.innerDiameter,
    height: mount.height,
    threadDiameter: attachment.nominalThreadDiameter,
    threadPitch: attachment.threadPitch,
    threadLength: attachment.threadLength,
    threadDirection: attachment.threadDirection,
    threadClearance: 0,
    wallThickness: mount.wallThickness,
    cableHoleDiameter: mount.cableHoleDiameter,
    supportLipEnabled: true,
    supportLipInnerDiameter: attachment.seatInnerDiameter,
    supportLipOuterDiameter: attachment.seatOuterDiameter,
    supportLipThickness: attachment.flangeThickness,
    supportLipZ: mount.height - attachment.threadLength,
  }
}

export function deriveShadeNeckParameters(
  mount: MountBodyParameters,
  attachment: AttachmentInterface,
): ShadeNeckParameters {
  const ringInnerDiameter = attachment.nominalThreadDiameter + attachment.threadClearance * 2
  const ringOuterDiameter = ringInnerDiameter + attachment.ringWallThickness * 2
  const flangeInnerDiameter = attachment.seatInnerDiameter + attachment.flangeRadialClearance * 2
  return {
    neckOuterDiameter: attachment.seatInnerDiameter - attachment.flangeRadialClearance * 2,
    neckInnerDiameter: mount.innerDiameter,
    neckHeight: attachment.neckHeight,
    flangeOuterDiameter: Math.min(
      attachment.seatOuterDiameter - attachment.flangeRadialClearance * 2,
      ringOuterDiameter - Math.max(0.5, attachment.flangeRadialClearance * 0.25),
    ),
    flangeInnerDiameter,
    flangeThickness: attachment.flangeThickness,
    flangePosition: 0,
    seatClearance: attachment.flangeRadialClearance,
  }
}

export function deriveRetainingRingParameters(
  attachment: AttachmentInterface,
  grip: RetainingRingGripParameters,
): RetainingRingParameters {
  const innerDiameter = attachment.nominalThreadDiameter + attachment.threadClearance * 2
  return {
    outerDiameter: innerDiameter + attachment.ringWallThickness * 2,
    innerDiameter,
    height: attachment.ringHeight,
    wallThickness: attachment.ringWallThickness,
    threadDiameter: attachment.nominalThreadDiameter,
    threadPitch: attachment.threadPitch,
    threadLength: attachment.threadLength,
    threadClearance: attachment.threadClearance,
    threadDirection: attachment.threadDirection,
    gripStyle: grip.gripStyle,
    gripDepth: grip.gripDepth,
    gripCount: grip.gripCount,
  }
}
