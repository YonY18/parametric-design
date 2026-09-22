import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { ConnectionFrame, MeshData, ProfileRing } from '../geometry/types'
import type { GenerationStatus } from '../store/modelStore'

interface ViewportProps {
  mesh: MeshData | null
  status: GenerationStatus
  error: string | null
}

function createGeometry(mesh: MeshData): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3))
  geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1))
  if (mesh.normals) {
    geometry.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3))
  } else {
    geometry.computeVertexNormals()
  }
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

function getDimensions(mesh: MeshData): THREE.Vector3 | null {
  const bounds = new THREE.Box3()
  for (let index = 0; index < mesh.positions.length; index += 3) {
    bounds.expandByPoint(new THREE.Vector3(mesh.positions[index], mesh.positions[index + 1], mesh.positions[index + 2]))
  }
  return bounds.isEmpty() ? null : bounds.getSize(new THREE.Vector3())
}

function formatDimension(value: number): string {
  return `${value.toFixed(1)} mm`
}

function disposeObjectResources(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
      child.geometry.dispose()
      if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose())
      else child.material.dispose()
    }
  })
}

function createProfileRingMarker(ring: ProfileRing, color: string): THREE.LineLoop {
  const points = ring.points.map((point) => new THREE.Vector3(
    Math.cos(point.angle) * point.radius,
    Math.sin(point.angle) * point.radius,
    ring.z,
  ))
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  return new THREE.LineLoop(geometry, new THREE.LineBasicMaterial({ color }))
}

function createDebugMarker(frame: ConnectionFrame, color: string): THREE.Group {
  const marker = new THREE.Group()
  const radius = Math.max(frame.radius * 0.08, 1.5)
  const material = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
  const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 0.72, radius, 32), material)
  ring.position.set(frame.position.x, frame.position.y, frame.position.z)
  marker.add(ring)

  const center = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.16, 12, 8), material.clone())
  center.position.set(frame.position.x, frame.position.y, frame.position.z)
  marker.add(center)

  const axisGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(frame.position.x, frame.position.y, frame.position.z - radius * 1.8),
    new THREE.Vector3(frame.position.x, frame.position.y, frame.position.z + radius * 1.8),
  ])
  marker.add(new THREE.Line(axisGeometry, new THREE.LineBasicMaterial({ color })))
  return marker
}

const debugColors = ['#f2b76d', '#83e3ce', '#e889d4', '#7dc8ff']
const partColors: Record<string, string> = {
  mount: '#d89a68',
  'mount-seat': '#c4a06c',
  'shade-neck': '#9dd4c5',
  'retaining-ring': '#83e3ce',
  transition: '#e889d4',
  shade: '#55c7b0',
  'decorative-shade': '#55c7b0',
  'threaded-hub': '#d89a68',
  'internal-support': '#9dd4c5',
}
const mechanicalPartIds = new Set(['mount', 'mount-seat', 'threaded-hub', 'internal-support', 'retaining-ring'])

export function Viewport({ mesh, status, error }: ViewportProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const meshRef = useRef<THREE.Mesh | null>(null)
  const geometryRef = useRef<THREE.BufferGeometry | null>(null)
  const partsGroupRef = useRef<THREE.Group | null>(null)
  const debugGroupRef = useRef<THREE.Group | null>(null)
  const fitTargetRef = useRef<THREE.Group | null>(null)
  const fitRef = useRef<() => void>(() => undefined)
  const hasRenderedMeshRef = useRef(false)
  const [debugConnections, setDebugConnections] = useState(false)
  const [explodedView, setExplodedView] = useState(false)
  const [showMechanicalParts, setShowMechanicalParts] = useState(true)
  const [showRetainingRing, setShowRetainingRing] = useState(true)
  const [mechanicalCutaway, setMechanicalCutaway] = useState(false)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#101820')
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 5000)
    camera.position.set(110, -130, 90)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 3
    controls.maxDistance = 2000
    controls.target.set(0, 0, 30)

    const grid = new THREE.GridHelper(320, 32, '#33515c', '#1d3039')
    grid.position.y = -0.01
    scene.add(grid)

    scene.add(new THREE.HemisphereLight('#d9f5ff', '#15232d', 1.8))
    const keyLight = new THREE.DirectionalLight('#fff4df', 3.2)
    keyLight.position.set(80, -100, 180)
    scene.add(keyLight)
    const fillLight = new THREE.DirectionalLight('#7dc8ff', 1.2)
    fillLight.position.set(-120, 80, 60)
    scene.add(fillLight)

    const visualizationGroup = new THREE.Group()
    const partsGroup = new THREE.Group()
    const debugGroup = new THREE.Group()
    const geometry = new THREE.BufferGeometry()
    const material = new THREE.MeshStandardMaterial({
      color: '#55c7b0',
      roughness: 0.3,
      metalness: 0.08,
      side: THREE.DoubleSide,
    })
    const modelMesh = new THREE.Mesh(geometry, material)
    modelMesh.castShadow = true
    modelMesh.receiveShadow = true
    visualizationGroup.add(modelMesh, partsGroup)
    scene.add(visualizationGroup, debugGroup)
    meshRef.current = modelMesh
    geometryRef.current = geometry
    partsGroupRef.current = partsGroup
    debugGroupRef.current = debugGroup
    fitTargetRef.current = visualizationGroup

    const fitToObject = () => {
      if (!fitTargetRef.current) return
      const bounds = new THREE.Box3().setFromObject(fitTargetRef.current)
      if (bounds.isEmpty()) return
      const center = bounds.getCenter(new THREE.Vector3())
      const size = bounds.getSize(new THREE.Vector3())
      const maxDimension = Math.max(size.x, size.y, size.z)
      const distance = (maxDimension / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.45
      const direction = camera.position.clone().sub(controls.target).normalize()
      camera.position.copy(center).add(direction.multiplyScalar(Math.max(distance, 10)))
      camera.near = Math.max(distance / 100, 0.01)
      camera.far = Math.max(distance * 100, 1000)
      camera.updateProjectionMatrix()
      controls.target.copy(center)
      controls.update()
    }
    fitRef.current = fitToObject

    const resize = () => {
      const width = mount.clientWidth
      const height = mount.clientHeight
      if (!width || !height) return
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(mount)
    resize()

    let animationFrame = 0
    const animate = () => {
      animationFrame = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
      controls.dispose()
      geometryRef.current?.dispose()
      if (partsGroupRef.current) disposeObjectResources(partsGroupRef.current)
      if (debugGroupRef.current) disposeObjectResources(debugGroupRef.current)
      material.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      meshRef.current = null
      geometryRef.current = null
      partsGroupRef.current = null
      debugGroupRef.current = null
      fitTargetRef.current = null
      fitRef.current = () => undefined
    }
  }, [])

  useEffect(() => {
    const modelMesh = meshRef.current
    const partsGroup = partsGroupRef.current
    const debugGroup = debugGroupRef.current
    if (!modelMesh || !partsGroup || !debugGroup) return

    disposeObjectResources(partsGroup)
    partsGroup.clear()
    disposeObjectResources(debugGroup)
    debugGroup.clear()

    if (!mesh) {
      modelMesh.visible = false
      return
    }

    const nextGeometry = createGeometry(mesh)
    const previousGeometry = geometryRef.current
    modelMesh.geometry = nextGeometry
    geometryRef.current = nextGeometry

    const parts = mesh.parts ?? []
    const renderParts = parts.length > 0 && (explodedView || mechanicalCutaway || !showMechanicalParts || !showRetainingRing)
    if (renderParts) {
      modelMesh.visible = false
      const dimensions = getDimensions(mesh)
      const separation = Math.max(12, (dimensions?.z ?? 100) * 0.08)
      parts.forEach((part, index) => {
        const isMechanical = mechanicalPartIds.has(part.id)
        const visible = mechanicalCutaway
          ? isMechanical
          : (!isMechanical || showMechanicalParts) && (part.id !== 'retaining-ring' || showRetainingRing)
        const partMesh = new THREE.Mesh(
          createGeometry(part.mesh),
          new THREE.MeshStandardMaterial({
            color: partColors[part.id] ?? '#83e3ce',
            roughness: 0.3,
            metalness: 0.08,
            side: THREE.DoubleSide,
          }),
        )
        partMesh.visible = visible
        partMesh.position.z = explodedView ? index * separation : 0
        partMesh.castShadow = true
        partMesh.receiveShadow = true
        partsGroup.add(partMesh)
      })
    } else {
      modelMesh.visible = true
    }

    if (debugConnections) {
      for (const [index, marker] of (mesh.connectionFrames ?? []).entries()) {
        debugGroup.add(createDebugMarker(marker.frame, debugColors[index % debugColors.length]))
      }
      for (const [index, marker] of (mesh.profileRings ?? []).entries()) {
        debugGroup.add(createProfileRingMarker(marker.ring, debugColors[(index + 1) % debugColors.length]))
      }
    }

    previousGeometry?.dispose()
    if (!hasRenderedMeshRef.current) {
      hasRenderedMeshRef.current = true
      window.requestAnimationFrame(() => fitRef.current())
    }
  }, [mesh, debugConnections, explodedView, showMechanicalParts, showRetainingRing, mechanicalCutaway])

  const dimensions = mesh ? getDimensions(mesh) : null
  const isLoading = status === 'generating'

  return (
    <section className="viewport-panel">
      <div className="viewport-toolbar">
        <div>
          <span className="eyebrow">Workspace</span>
          <h1>3D Viewport</h1>
        </div>
        <div className="viewport-actions">
          {dimensions && (
            <div className="viewport-dimensions" aria-label="Bounding-box dimensions">
              <span>Dimensions</span>
              <strong>X {formatDimension(dimensions.x)}</strong>
              <strong>Y {formatDimension(dimensions.y)}</strong>
              <strong>Z {formatDimension(dimensions.z)}</strong>
            </div>
          )}
          <button
            aria-pressed={showMechanicalParts}
            className={`toggle-button${showMechanicalParts ? ' is-active' : ''}`}
            onClick={() => setShowMechanicalParts((value) => !value)}
            type="button"
          >
            Show Mechanical Parts
          </button>
          <button
            aria-pressed={showRetainingRing}
            className={`toggle-button${showRetainingRing ? ' is-active' : ''}`}
            onClick={() => setShowRetainingRing((value) => !value)}
            type="button"
          >
            {showRetainingRing ? 'Hide Ring' : 'Show Retaining Ring'}
          </button>
          <button
            aria-pressed={mechanicalCutaway}
            className={`toggle-button${mechanicalCutaway ? ' is-active' : ''}`}
            onClick={() => setMechanicalCutaway((value) => !value)}
            type="button"
          >
            Mechanical Cutaway
          </button>
          <button
            aria-pressed={debugConnections}
            className={`toggle-button${debugConnections ? ' is-active' : ''}`}
            onClick={() => setDebugConnections((value) => !value)}
            type="button"
          >
            Connections
          </button>
          <button
            aria-pressed={explodedView}
            className={`toggle-button${explodedView ? ' is-active' : ''}`}
            onClick={() => setExplodedView((value) => !value)}
            type="button"
          >
            Exploded
          </button>
          <span className={`status-indicator status-${status}`}>
            <span className="status-dot" />
            {status === 'generating' ? 'Generating' : status === 'error' ? 'Needs attention' : 'Ready'}
          </span>
          <button className="fit-button" disabled={!mesh} onClick={() => fitRef.current()} type="button">
            Fit object <span>F</span>
          </button>
        </div>
      </div>
      <div className="viewport-canvas" ref={mountRef}>
        {!mesh && status !== 'generating' && <div className="viewport-empty">Select a generator to create geometry.</div>}
        {isLoading && (
          <div className="viewport-loading">
            <span className="loading-spinner" />
            <span>Computing solid in worker…</span>
          </div>
        )}
        {error && <div className="viewport-error">{error}</div>}
        <div className="viewport-hint">Drag to orbit · Scroll to zoom · Shift + drag to pan</div>
      </div>
    </section>
  )
}
