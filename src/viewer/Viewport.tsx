import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { MeshData } from '../geometry/types'
import type { GenerationStatus } from '../store/modelStore'

interface ViewportProps {
  mesh: MeshData | null
  status: GenerationStatus
  error: string | null
}

function updateGeometry(geometry: THREE.BufferGeometry, mesh: MeshData): void {
  geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3))
  geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1))
  if (mesh.normals) {
    geometry.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3))
  } else {
    geometry.deleteAttribute('normal')
    geometry.computeVertexNormals()
  }
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
}

export function Viewport({ mesh, status, error }: ViewportProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const meshRef = useRef<THREE.Mesh | null>(null)
  const geometryRef = useRef<THREE.BufferGeometry | null>(null)
  const fitRef = useRef<() => void>(() => undefined)
  const latestMeshRef = useRef(mesh)
  latestMeshRef.current = mesh

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
    scene.add(modelMesh)
    meshRef.current = modelMesh
    geometryRef.current = geometry

    const fitToObject = () => {
      if (!meshRef.current) return
      const bounds = new THREE.Box3().setFromObject(meshRef.current)
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

    if (latestMeshRef.current) {
      updateGeometry(geometry, latestMeshRef.current)
      fitToObject()
    }

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
      geometry.dispose()
      material.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      meshRef.current = null
      geometryRef.current = null
      fitRef.current = () => undefined
    }
  }, [])

  useEffect(() => {
    if (!mesh || !geometryRef.current) return
    updateGeometry(geometryRef.current, mesh)
    window.requestAnimationFrame(() => fitRef.current())
  }, [mesh])

  const isLoading = status === 'generating'

  return (
    <section className="viewport-panel">
      <div className="viewport-toolbar">
        <div>
          <span className="eyebrow">Workspace</span>
          <h1>3D Viewport</h1>
        </div>
        <div className="viewport-actions">
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
