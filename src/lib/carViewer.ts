import {
  ACESFilmicToneMapping,
  Box3,
  CanvasTexture,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  type Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  Sphere,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const MODEL_URL = `${import.meta.env.BASE_URL}models/vw-gol-g5-prata.glb`

export type ViewerStatus = 'loading' | 'ready' | 'error'

/** Sombra suave no chão, desenhada num canvas 2D (sem precisar de luz com sombra). */
function makeShadowTexture(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64)
  grad.addColorStop(0, 'rgba(0,0,0,0.55)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return new CanvasTexture(c)
}

/**
 * Visualizador 3D único para o app inteiro.
 *
 * O renderer, o modelo e a câmera são criados uma vez e ficam na memória.
 * Cada tela só "encaixa" (attach) o elemento do canvas no seu contêiner e o
 * "desencaixa" (detach) ao sair — assim voltar para a Home não recarrega o
 * modelo nem reinicia a cena, e o render fica pausado enquanto não há onde
 * mostrar.
 */
class CarViewer {
  status: ViewerStatus = 'loading'
  private listeners = new Set<() => void>()

  private readonly el = document.createElement('div')
  private renderer: WebGLRenderer | null = null
  private scene = new Scene()
  private camera = new PerspectiveCamera(32, 1, 0.1, 100)
  private controls: OrbitControls | null = null

  private host: HTMLElement | null = null
  private onScreen = true
  private tabVisible = !document.hidden
  private io: IntersectionObserver
  private ro: ResizeObserver

  constructor() {
    this.el.style.cssText = 'position:absolute;inset:0'
    this.io = new IntersectionObserver(([entry]) => {
      this.onScreen = entry.isIntersecting
      this.syncLoop()
    })
    this.ro = new ResizeObserver(() => this.resize())
    document.addEventListener('visibilitychange', () => {
      this.tabVisible = !document.hidden
      this.syncLoop()
    })

    try {
      this.init()
    } catch {
      this.setStatus('error') // sem WebGL
    }
  }

  private init() {
    const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
    this.renderer = renderer
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.9
    renderer.setClearColor(new Color(0x000000), 0)

    const canvas = renderer.domElement
    canvas.setAttribute('role', 'img')
    canvas.setAttribute('aria-label', 'Modelo 3D do carro. Arraste para girar.')
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y'
    canvas.addEventListener('webglcontextlost', (e) => e.preventDefault())
    this.el.appendChild(canvas)

    const pmrem = new PMREMGenerator(renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()

    const controls = new OrbitControls(this.camera, canvas)
    this.controls = controls
    controls.enableZoom = false
    controls.enablePan = false
    controls.enableDamping = true
    controls.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    controls.autoRotateSpeed = 1.5
    controls.minPolarAngle = Math.PI * 0.28
    controls.maxPolarAngle = Math.PI * 0.49 // não deixa passar para baixo do chão
    canvas.style.touchAction = 'pan-y' // o OrbitControls trava o gesto; libera a rolagem vertical

    const draco = new DRACOLoader() // decodificadores já vêm embutidos no three
    new GLTFLoader().setDRACOLoader(draco).load(
      MODEL_URL,
      (gltf) => {
        this.place(gltf.scene)
        draco.dispose()
        this.setStatus('ready')
        this.syncLoop()
      },
      undefined,
      () => this.setStatus('error'),
    )
  }

  /** Centraliza o carro, apoia as rodas em y=0, enquadra a câmera e cria a sombra. */
  private place(model: Object3D) {
    const box = new Box3().setFromObject(model)
    const center = box.getCenter(new Vector3())
    model.position.set(-center.x, -box.min.y, -center.z)
    this.scene.add(model)

    const size = box.getSize(new Vector3())
    const sphere = box.getBoundingSphere(new Sphere())
    const dist = (sphere.radius / Math.sin((this.camera.fov * Math.PI) / 360)) * 0.66
    this.camera.position.set(dist * 0.72, size.y * 0.7, dist * 0.7)
    const c = this.controls!
    c.target.set(0, size.y * 0.42, 0)
    c.minDistance = c.maxDistance = this.camera.position.distanceTo(c.target)
    c.update()

    const len = Math.max(size.x, size.z)
    const shadow = new Mesh(
      new PlaneGeometry(len * 1.5, len * 1.5),
      new MeshBasicMaterial({
        map: makeShadowTexture(),
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
      }),
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = 0.005
    this.scene.add(shadow)
  }

  private tick = () => {
    this.controls?.update()
    this.renderer?.render(this.scene, this.camera)
  }

  private syncLoop() {
    this.renderer?.setAnimationLoop(
      this.host && this.onScreen && this.tabVisible && this.status === 'ready' ? this.tick : null,
    )
  }

  private resize() {
    const host = this.host
    if (!host || !this.renderer) return
    const { clientWidth: w, clientHeight: h } = host
    if (w === 0 || h === 0) return
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  attach(host: HTMLElement) {
    this.host = host
    host.appendChild(this.el)
    this.io.observe(host)
    this.ro.observe(host)
    this.resize()
    this.syncLoop()
  }

  detach(host: HTMLElement) {
    if (this.host !== host) return // outra tela já assumiu
    this.io.disconnect()
    this.ro.disconnect()
    this.el.remove()
    this.host = null
    this.syncLoop()
  }

  private setStatus(s: ViewerStatus) {
    this.status = s
    this.listeners.forEach((l) => l())
  }

  subscribe = (cb: () => void) => {
    this.listeners.add(cb)
    return () => {
      this.listeners.delete(cb)
    }
  }
  getStatus = () => this.status
}

let instance: CarViewer | null = null
export const getCarViewer = () => (instance ??= new CarViewer())
