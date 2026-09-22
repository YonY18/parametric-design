import { assembleComponents, type AssemblyComponent } from '../geometry/assembly'
import { createWaveLampProfileRing, generateWaveLampMesh } from '../geometry/waveLamp'
import { genericThreadedMount } from '../geometry/mounts'
import { retainingRingDefinition } from '../geometry/retainingRing'
import { generateInternalShadeSupport } from '../geometry/internalShadeSupport'
import { generateThreadedHub } from '../geometry/threadedHub'
import {
  deriveMountParameters,
  deriveRetainingRingParameters,
  resolveAttachmentInterface,
  type MountBodyParameters,
} from '../geometry/attachmentInterface'
import { generateTransitionMesh, getTransitionDefinition } from '../geometry/transitions'
import { createConnectionFrame, validateMeshData, type GeometryBackend, type GeometryRequest, type MeshData } from '../geometry/types'
import { parametricWaveLamp } from '../generators/wave-lamp'
import type { WaveLampParameterValues } from '../generators/wave-lamp'

function number(parameters: WaveLampParameterValues, id: string, fallback?: number): number {
  const value = parameters[id]
  if (value === undefined && fallback !== undefined) return fallback
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) throw new Error(`Parameter "${id}" must be a finite number.`)
  return numberValue
}

function appendMechanicalMarkers(mesh: MeshData, markers: readonly { id: string; frame: ReturnType<typeof createConnectionFrame> }[]): MeshData {
  return {
    ...mesh,
    connectionFrames: [...(mesh.connectionFrames ?? []), ...markers],
  }
}

function composeUnmountedWaveLamp(parameters: WaveLampParameterValues, bottomRadius: number, shadeWallThickness: number): MeshData {
  const requestedStartRadius = number(parameters, 'transitionStartRadius', 0)
  const requestedEndRadius = number(parameters, 'transitionEndRadius', 0)
  const transitionInputFrame = createConnectionFrame(0, requestedStartRadius > 0 ? requestedStartRadius : bottomRadius)
  const transition = getTransitionDefinition(String(parameters.transitionType ?? 'straight')).generate({
    height: number(parameters, 'transitionHeight', 0),
    startRadius: requestedStartRadius,
    endRadius: requestedEndRadius,
  }, transitionInputFrame)
  const actualTransitionEndRadius = transition.outputFrame.radius
  const shadeTargetProfile = createWaveLampProfileRing({
    parameters,
    inputFrame: transition.outputFrame,
    normalizedHeight: 0,
    deformationWeight: 1,
  })
  const shadeInnerTargetProfile = {
    z: shadeTargetProfile.z,
    points: shadeTargetProfile.points.map((point) => ({
      angle: point.angle,
      radius: point.radius - shadeWallThickness,
    })),
  }
  const transitionMesh = transition.height > 0
    ? generateTransitionMesh(
      transition,
      Math.max(0, transition.startRadius - shadeWallThickness),
      Math.max(0, actualTransitionEndRadius - shadeWallThickness),
      {
        outerTargetProfile: shadeTargetProfile,
        innerTargetProfile: shadeInnerTargetProfile,
        radialSegments: number(parameters, 'radialSegments'),
      },
    )
    : undefined
  const shadeMesh = generateWaveLampMesh(parameters, { shadeInputFrame: transition.outputFrame })
  const components: AssemblyComponent[] = []
  if (transitionMesh) {
    components.push({
      id: 'transition',
      mesh: transitionMesh,
      inputFrame: transition.inputFrame,
      outputFrame: transition.outputFrame,
    })
  }
  components.push({ id: 'shade', mesh: shadeMesh, inputFrame: transition.outputFrame })
  const assembled = assembleComponents(components)
  if (transitionMesh) return { ...assembled, profileRings: [] }
  return {
    ...assembled,
    profileRings: [],
    connectionFrames: [
      ...(assembled.connectionFrames ?? []),
      { id: 'transition:input', frame: transition.inputFrame },
      { id: 'transition:output', frame: transition.outputFrame },
    ],
  }
}

function appendComponent(
  base: MeshData,
  component: AssemblyComponent,
): MeshData {
  const vertexOffset = base.positions.length / 3
  const positions = new Float32Array(base.positions.length + component.mesh.positions.length)
  positions.set(base.positions)
  positions.set(component.mesh.positions, base.positions.length)
  const indices = new Uint32Array(base.indices.length + component.mesh.indices.length)
  indices.set(base.indices)
  for (let index = 0; index < component.mesh.indices.length; index += 1) {
    indices[base.indices.length + index] = component.mesh.indices[index] + vertexOffset
  }
  const normals = base.normals && component.mesh.normals
    ? new Float32Array([...base.normals, ...component.mesh.normals])
    : undefined
  const result: MeshData = {
    ...base,
    positions,
    indices,
    normals,
    parts: [...(base.parts ?? []), {
      id: component.id,
      mesh: component.mesh,
      inputFrame: component.inputFrame,
      outputFrame: component.outputFrame,
    }],
    connectionFrames: [
      ...(base.connectionFrames ?? []),
      ...(component.inputFrame ? [{ id: `${component.id}:input`, frame: component.inputFrame }] : []),
      ...(component.outputFrame ? [{ id: `${component.id}:output`, frame: component.outputFrame }] : []),
    ],
  }
  validateMeshData(result)
  return result
}

function composeMountedWaveLamp(parameters: WaveLampParameterValues, shadeWallThickness: number): MeshData {
  const attachment = resolveAttachmentInterface(parameters)
  const mountBody: MountBodyParameters = {
    outerDiameter: number(parameters, 'mountOuterDiameter'),
    innerDiameter: number(parameters, 'mountInnerDiameter'),
    height: number(parameters, 'mountHeight'),
    wallThickness: number(parameters, 'mountWallThickness'),
    cableHoleDiameter: number(parameters, 'mountCableHoleDiameter'),
  }
  const mount = genericThreadedMount.generate(deriveMountParameters(mountBody, attachment))
  if (!mount.supportLip) throw new Error('Mounted Wave Lamp requires generated Mount Seat/support lip geometry.')

  const shadeStartFrame = createConnectionFrame(mount.supportLip.frame.position.z, number(parameters, 'bottomDiameter') / 2)
  const shadeMesh = generateWaveLampMesh(parameters, { shadeInputFrame: shadeStartFrame })
  const supportProfile = createWaveLampProfileRing({
    parameters,
    inputFrame: shadeStartFrame,
    normalizedHeight: number(parameters, 'supportInset') / number(parameters, 'height'),
    deformationWeight: 1,
  })
  const support = generateInternalShadeSupport({
    supportType: String(parameters.supportType ?? 'annular') as 'annular' | '3-arm' | '4-arm',
    supportInset: number(parameters, 'supportInset'),
    supportThickness: number(parameters, 'supportThickness'),
    hubOuterDiameter: number(parameters, 'hubOuterDiameter'),
    shadeWallThickness,
    radialSegments: number(parameters, 'radialSegments'),
  }, supportProfile, shadeStartFrame.position.z)
  const hub = generateThreadedHub({
    hubOuterDiameter: number(parameters, 'hubOuterDiameter'),
    hubHeight: number(parameters, 'hubHeight'),
    hubWallThickness: number(parameters, 'hubWallThickness'),
    threadDiameter: attachment.nominalThreadDiameter,
    threadPitch: attachment.threadPitch,
    threadLength: attachment.threadLength,
    threadClearance: attachment.threadClearance,
    threadDirection: attachment.threadDirection,
    radialSegments: number(parameters, 'radialSegments'),
  }, createConnectionFrame(shadeStartFrame.position.z, number(parameters, 'hubOuterDiameter') / 2))
  const ringParameters = deriveRetainingRingParameters(attachment, {
    gripStyle: String(parameters.retainingRingGripStyle) as 'smooth' | 'ribs' | 'scalloped',
    gripDepth: number(parameters, 'retainingRingGripDepth'),
    gripCount: number(parameters, 'retainingRingGripCount'),
  })
  const ring = retainingRingDefinition.generate(
    ringParameters,
    createConnectionFrame(shadeStartFrame.position.z, ringParameters.outerDiameter / 2),
  )

  let assembled = assembleComponents([
    { id: 'mount', mesh: mount.mesh, outputFrame: mount.supportLip.frame },
    { id: 'mount-seat', mesh: mount.supportLip.mesh, inputFrame: mount.supportLip.frame, outputFrame: mount.supportLip.frame },
  ])
  assembled = appendComponent(assembled, {
    id: 'threaded-hub',
    mesh: hub.mesh,
    inputFrame: hub.inputFrame,
    outputFrame: hub.outputFrame,
  })
  assembled = appendComponent(assembled, {
    id: 'internal-support',
    mesh: support.mesh,
    inputFrame: support.inputFrame,
    outputFrame: support.outputFrame,
  })
  assembled = appendComponent(assembled, {
    id: 'decorative-shade',
    mesh: shadeMesh,
    inputFrame: shadeStartFrame,
  })
  assembled = appendComponent(assembled, {
    id: 'retaining-ring',
    mesh: ring.mesh,
    inputFrame: ring.inputFrame,
    outputFrame: ring.outputFrame,
  })

  const markers = [
    { id: 'mount-seat:support-lip-plane', frame: mount.supportLip.frame },
    { id: 'threaded-hub:attachment-interface', frame: hub.inputFrame },
    { id: 'internal-support:plate-plane', frame: support.inputFrame },
    { id: 'retaining-ring:pressure-face', frame: ring.pressureFaceFrame },
    { id: 'decorative-shade:mounting-end', frame: shadeStartFrame },
  ]
  return appendMechanicalMarkers({
    ...assembled,
    profileRings: [
      { id: 'decorative-shade:support-interior-profile', ring: support.outerProfile },
      { id: 'decorative-shade:mounting-profile', ring: createWaveLampProfileRing({
        parameters,
        inputFrame: shadeStartFrame,
        normalizedHeight: 0,
        deformationWeight: 1,
      }) },
    ],
  }, markers)
}

function composeWaveLamp(parameters: WaveLampParameterValues): MeshData {
  const bottomRadius = number(parameters, 'bottomDiameter') / 2
  const shadeWallThickness = number(parameters, 'wallThickness')
  return String(parameters.mountType ?? 'none') === 'generic-threaded'
    ? composeMountedWaveLamp(parameters, shadeWallThickness)
    : composeUnmountedWaveLamp(parameters, bottomRadius, shadeWallThickness)
}

export const proceduralBackend: GeometryBackend = {
  id: 'procedural',
  async generate(request: GeometryRequest): Promise<MeshData> {
    if (request.operation !== 'wave-lamp') {
      throw new Error(`Unsupported procedural operation: ${request.operation}`)
    }
    const parameters = request.parameters as WaveLampParameterValues
    const validation = parametricWaveLamp.validate(parameters)
    if (!validation.valid) throw new Error(validation.errors.join(' '))
    return composeWaveLamp(parameters)
  },
}
