import { Component, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import gsap from 'gsap'
import * as THREE from 'three'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { promiseView, statusWord, visibleIds } from '../hall/machine'
import type { HallState, Session } from '../hall/types'

RectAreaLightUniformsLib.init()

const FACE = '#E6E1D8'
const INK = '#1A1916'
const STRAP = '#1F6B4A'
const METAL = '#B7B1A6'
const AIR = '#141311'

export function badgePosition(index: number): [number, number, number] {
  return [0.15 + index * 0.85, -0.02, -index * 2.3]
}

export function frameFor(index: number) {
  const [x, y, z] = badgePosition(index)
  return {
    position: [x + 0.2, y + 0.22, z + 4.7] as [number, number, number],
    lookAt: [x + 0.95, y + 0.02, z - 0.4] as [number, number, number],
  }
}

function webglOk() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

class Boundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onError()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

function CameraRig({ index, reduce }: { index: number; reduce: boolean }) {
  const { camera } = useThree()
  useEffect(() => {
    const frame = frameFor(index)
    const look = new THREE.Vector3(...frame.lookAt)
    if (reduce) {
      camera.position.set(...frame.position)
      camera.lookAt(look)
      return
    }
    const proxy = { x: camera.position.x, y: camera.position.y, z: camera.position.z }
    const tween = gsap.to(proxy, {
      x: frame.position[0],
      y: frame.position[1],
      z: frame.position[2],
      duration: 1.15,
      ease: 'power3.inOut',
      onUpdate: () => {
        camera.position.set(proxy.x, proxy.y, proxy.z)
        camera.lookAt(look)
      },
    })
    return () => {
      tween.kill()
    }
  }, [camera, index, reduce])
  return null
}

function useBadgeTexture(session: Session, dark: boolean) {
  const status = statusWord(session)
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 680
    const pen = canvas.getContext('2d')
    if (!pen) return new THREE.CanvasTexture(canvas)
    pen.fillStyle = dark ? '#6A655C' : FACE
    pen.fillRect(0, 0, 512, 680)
    pen.textAlign = 'center'
    pen.textBaseline = 'middle'
    pen.fillStyle = dark ? '#E6E1D8' : INK
    pen.font = '600 72px Satoshi, sans-serif'
    pen.fillText(session.name, 256, 250, 460)
    pen.font = '500 32px Satoshi, sans-serif'
    pen.fillStyle = dark ? '#C8C2B6' : '#5C564C'
    if (session.org) pen.fillText(session.org, 256, 330, 440)
    pen.font = '400 28px Satoshi, sans-serif'
    pen.fillStyle = dark ? '#B7B1A6' : '#3A362F'
    if (session.topic && session.topic !== 'A conversation') pen.fillText(session.topic, 256, 392, 440)
    if (status !== 'New' && status !== 'Open') {
      pen.font = '700 22px Satoshi, sans-serif'
      pen.fillStyle = dark ? '#9DCFB4' : '#1F6B4A'
      pen.fillText(status.toUpperCase(), 256, 470, 440)
    }
    const next = new THREE.CanvasTexture(canvas)
    next.anisotropy = 8
    next.colorSpace = THREE.SRGBColorSpace
    return next
  }, [session.name, session.org, session.topic, status, dark])

  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

function HangTag({ x, kept, seed, freeze }: { x: number; kept: boolean; seed: number; freeze: boolean }) {
  const ref = useRef<THREE.Group>(null)
  useFrame((state) => {
    const group = ref.current
    if (!group) return
    if (kept || freeze) {
      group.position.y = kept ? -0.62 : -0.78
      group.rotation.z = 0
      return
    }
    const t = state.clock.elapsedTime
    group.position.y = -0.78 + Math.sin(t * 1.35 + seed) * 0.02
    group.rotation.z = Math.sin(t * 1.35 + seed) * 0.14
  })
  return (
    <group ref={ref} position={[x, -0.78, 0.06]}>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.004, 0.004, 0.16, 6]} />
        <meshStandardMaterial color={METAL} roughness={0.35} metalness={0.6} />
      </mesh>
      <mesh position={[0, -0.02, 0]} castShadow>
        <boxGeometry args={[0.16, 0.09, 0.012]} />
        <meshStandardMaterial color={kept ? STRAP : METAL} roughness={kept ? 0.72 : 0.4} metalness={kept ? 0.05 : 0.45} />
      </mesh>
    </group>
  )
}

function ClothStrap({ color }: { color: string }) {
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.46, 0),
      new THREE.Vector3(0.05, 1.24, 0.03),
      new THREE.Vector3(-0.04, 1.04, 0.02),
      new THREE.Vector3(0, 0.86, 0.03),
    ])
    return new THREE.TubeGeometry(curve, 14, 0.032, 6, false)
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial color={color} roughness={0.92} />
    </mesh>
  )
}

function BadgeMesh({
  session,
  index,
  active,
  flipped,
  isolated,
  ghost,
  freeze,
  showStamp,
  proof,
  onSelect,
}: {
  session: Session
  index: number
  active: boolean
  flipped: boolean
  isolated: boolean
  ghost: boolean
  freeze: boolean
  showStamp: boolean
  proof: boolean
  onSelect: (id: string) => void
}) {
  const group = useRef<THREE.Group>(null)
  const stamp = useRef<THREE.Group>(null)
  const texture = useBadgeTexture(session, isolated && !active)
  const [x, y, z] = badgePosition(index)

  useEffect(() => {
    const node = group.current
    if (!node) return
    const rotation = !active ? -0.55 : flipped ? Math.PI : 0
    if (freeze) {
      node.rotation.y = rotation
      return
    }
    const tween = gsap.to(node.rotation, { y: rotation, duration: 1.15, ease: 'power3.inOut' })
    return () => {
      tween.kill()
    }
  }, [active, flipped, freeze])

  useEffect(() => {
    const mesh = stamp.current
    if (!mesh || !showStamp) return
    if (freeze) {
      mesh.position.y = -0.42
      mesh.scale.setScalar(1)
      return
    }
    const drop = gsap.fromTo(mesh.position, { y: 0.35 }, { y: -0.42, duration: 0.28, ease: 'power4.in' })
    const scale = gsap.fromTo(mesh.scale, { x: 1.45, y: 1.45, z: 1.45 }, { x: 1, y: 1, z: 1, duration: 0.28, ease: 'power4.in' })
    return () => {
      drop.kill()
      scale.kill()
    }
  }, [showStamp, freeze, proof])

  const face = isolated && !active ? '#6E6A62' : FACE
  const strap = isolated && !active ? '#163D2C' : STRAP

  return (
    <group
      position={[x, y, z]}
      onClick={(event) => {
        event.stopPropagation()
        onSelect(session.id)
      }}
      onPointerOver={(event) => {
        event.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = ''
      }}
    >
      {ghost && active && (
        <RoundedBox args={[1.08, 1.46, 0.025]} radius={0.05} smoothness={3} position={[0.06, -0.05, -0.16]}>
          <meshStandardMaterial color="#C8C2B6" roughness={0.92} />
        </RoundedBox>
      )}
      <group ref={group}>
        <ClothStrap color={strap} />
        <mesh position={[0, 0.8, 0.04]} castShadow>
          <boxGeometry args={[0.28, 0.1, 0.05]} />
          <meshStandardMaterial color={METAL} roughness={0.28} metalness={0.7} />
        </mesh>
        <RoundedBox args={[1.08, 1.46, 0.05]} radius={0.05} smoothness={3} castShadow receiveShadow>
          <meshStandardMaterial color={face} roughness={0.78} />
        </RoundedBox>
        <mesh position={[0, -0.02, 0.03]}>
          <planeGeometry args={[0.86, 1.14]} />
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>
        {session.promises.slice(0, 2).map((item, tagIndex) => (
          <HangTag
            key={item.id}
            x={tagIndex === 0 ? -0.18 : 0.18}
            kept={promiseView(item, session) === 'kept'}
            seed={index + tagIndex}
            freeze={freeze}
          />
        ))}
        {showStamp && (
          <group ref={stamp} position={[0.32, -0.42, 0.08]}>
            {proof ? (
              <mesh rotation={[Math.PI / 2, 0, 0.15]} castShadow>
                <boxGeometry args={[0.22, 0.028, 0.16]} />
                <meshStandardMaterial color="#8A847A" roughness={0.55} metalness={0.35} />
              </mesh>
            ) : (
              <mesh rotation={[Math.PI / 2, 0, 0.4]} castShadow>
                <cylinderGeometry args={[0.11, 0.11, 0.025, 28]} />
                <meshStandardMaterial color={STRAP} roughness={0.42} metalness={0.18} />
              </mesh>
            )}
          </group>
        )}
      </group>
    </group>
  )
}

// shortcut: six separate badge meshes, instance them if the hall grows past a dozen.
function Dust({ count, freeze }: { count: number; freeze: boolean }) {
  const ref = useRef<THREE.Points>(null)
  const positions = useMemo(() => {
    const values = new Float32Array(count * 3)
    for (let i = 0; i < count; i += 1) {
      values[i * 3] = (Math.random() - 0.5) * 6
      values[i * 3 + 1] = Math.random() * 2.6 - 0.4
      values[i * 3 + 2] = -Math.random() * 12
    }
    return values
  }, [count])

  useFrame((_, delta) => {
    if (freeze || !ref.current) return
    const attr = ref.current.geometry.attributes.position
    const values = attr.array as Float32Array
    for (let i = 1; i < values.length; i += 3) {
      values[i] += delta * 0.035
      if (values[i] > 2.3) values[i] = -0.4
    }
    attr.needsUpdate = true
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#A39E94" size={0.012} transparent opacity={0.28} depthWrite={false} sizeAttenuation />
    </points>
  )
}

function BeamDust({ freeze, isolated }: { freeze: boolean; isolated: boolean }) {
  const ref = useRef<THREE.Points>(null)
  const count = isolated ? 220 : 90
  const positions = useMemo(() => {
    const values = new Float32Array(count * 3)
    for (let i = 0; i < count; i += 1) {
      const t = Math.random()
      values[i * 3] = 0.35 + (Math.random() - 0.5) * (0.15 + t * 0.9)
      values[i * 3 + 1] = 1.7 - t * 1.7
      values[i * 3 + 2] = 1.5 - t * 2.2
    }
    return values
  }, [count])

  useFrame((_, delta) => {
    if (freeze || !ref.current) return
    const attr = ref.current.geometry.attributes.position
    const values = attr.array as Float32Array
    for (let i = 1; i < values.length; i += 3) {
      values[i] -= delta * 0.04
      if (values[i] < -0.2) values[i] = 1.6
    }
    attr.needsUpdate = true
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#F6E7C1" size={isolated ? 0.03 : 0.02} transparent opacity={isolated ? 0.9 : 0.7} depthWrite={false} sizeAttenuation />
    </points>
  )
}

function Floor({ flat }: { flat: boolean }) {
  const grid = useMemo(() => {
    const helper = new THREE.GridHelper(20, 20, '#3A3834', '#2A2824')
    helper.position.y = -1.22
    return helper
  }, [])
  useEffect(() => () => {
    grid.geometry.dispose()
    const material = grid.material
    if (Array.isArray(material)) material.forEach((entry) => entry.dispose())
    else material.dispose()
  }, [grid])

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.24, -2]} receiveShadow>
        <planeGeometry args={[20, 24]} />
        <meshStandardMaterial color="#1A1916" roughness={flat ? 1 : 0.9} metalness={flat ? 0 : 0.08} />
      </mesh>
      <primitive object={grid} />
    </>
  )
}

function BeamRig({
  index,
  reduce,
  isolated,
  dim,
  narrow,
}: {
  index: number
  reduce: boolean
  isolated: boolean
  dim: boolean
  narrow: boolean
}) {
  const group = useRef<THREE.Group>(null)
  const light = useRef<THREE.SpotLight>(null)
  const target = useRef<THREE.Object3D>(null)

  useEffect(() => {
    const lamp = light.current
    const aim = target.current
    if (!lamp || !aim) return
    lamp.target = aim
  }, [])

  useFrame(() => {
    light.current?.target?.updateMatrixWorld()
  })

  useEffect(() => {
    const node = group.current
    if (!node) return
    const [x, y, z] = badgePosition(index)
    if (reduce || !node.userData.placed) {
      node.position.set(x, y, z)
      node.userData.placed = true
      return
    }
    const tween = gsap.to(node.position, { x, y, z, duration: 1.15, ease: 'power3.inOut' })
    return () => {
      tween.kill()
    }
  }, [index, reduce])

  return (
    <group ref={group}>
      <object3D ref={target} />
      <spotLight
        ref={light}
        position={isolated ? [0, 2.42, 2.2] : [0.25, 2.62, 2.6]}
        angle={isolated ? 0.28 : 0.55}
        penumbra={0.45}
        intensity={dim ? 0 : isolated ? 18 : 8}
        color="#F3EDE2"
        distance={8}
        castShadow={!narrow}
      />
      <mesh position={[0.1, 1.57, 1.15]} rotation={[0.55, 0.12, 0]}>
        <coneGeometry args={[isolated ? 0.42 : 0.85, 2.8, 20, 1, true]} />
        <meshBasicMaterial color="#F3EDE2" transparent opacity={dim ? 0 : isolated ? 0.14 : 0.06} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {!dim && <BeamDust freeze={reduce} isolated={isolated} />}
    </group>
  )
}

function Scene({
  sessions,
  ids,
  activeId,
  reduce,
  flat,
  narrow,
  onSelect,
}: {
  sessions: Record<string, Session>
  ids: string[]
  activeId: string
  reduce: boolean
  flat: boolean
  narrow: boolean
  onSelect: (id: string) => void
}) {
  const active = sessions[activeId]
  const index = Math.max(0, ids.indexOf(activeId))
  const isolated = active.phase === 'review' || active.phase === 'outcome'
  const dim = active.event === 'TrueForge disconnected'

  return (
    <>
      <color attach="background" args={[AIR]} />
      <fog attach="fog" args={['#23201C', 4.5, narrow ? 9 : 16]} />
      <CameraRig index={index} reduce={reduce} />
      <ambientLight intensity={dim ? 0.03 : isolated ? 0.035 : 0.12} />
      <BeamRig index={index} reduce={reduce} isolated={isolated} dim={dim} narrow={narrow} />
      <directionalLight
        position={[2.4, 3.2, 2]}
        intensity={dim || isolated ? 0.04 : 0.35}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <Floor flat={flat} />
      {!isolated && !dim && <Dust count={narrow ? 70 : 240} freeze={reduce} />}
      {ids.map((id, badgeIndex) => {
        const session = sessions[id]
        const isActive = id === activeId
        return (
          <BadgeMesh
            key={id}
            session={session}
            index={badgeIndex}
            active={isActive}
            flipped={isActive && session.panel === 'source'}
            isolated={isolated || dim}
            ghost={isActive && session.version > 1}
            freeze={reduce}
            showStamp={isActive && (session.delivery === 'sent' || session.delivery === 'proof')}
            proof={session.delivery === 'proof'}
            onSelect={onSelect}
          />
        )
      })}
    </>
  )
}

function CssHall({
  ids,
  sessions,
  activeId,
  onSelect,
}: {
  ids: string[]
  sessions: Record<string, Session>
  activeId: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="css-hall" data-renderer="css">
      {ids.map((id, index) => (
        <button
          key={id}
          type="button"
          className={id === activeId ? 'css-badge near' : 'css-badge'}
          style={{ '--step': index } as React.CSSProperties}
          onClick={() => onSelect(id)}
        >
          <span>
            {sessions[id].name}
            {sessions[id].org ? <small>{sessions[id].org}</small> : null}
          </span>
        </button>
      ))}
    </div>
  )
}

export function Hall({
  state,
  reduce,
  flat,
  narrow,
  renderer,
  onFallback,
  onSelect,
}: {
  state: HallState
  reduce: boolean
  flat: boolean
  narrow: boolean
  renderer: 'webgl' | 'css'
  onFallback: () => void
  onSelect: (id: string) => void
}) {
  const ids = visibleIds(state)
  if (renderer === 'css') return <CssHall ids={ids} sessions={state.sessions} activeId={state.activeId} onSelect={onSelect} />

  const opening = frameFor(0)
  return (
    <Boundary onError={onFallback}>
      <Canvas
        className="hall-canvas"
        dpr={[1, 1.6]}
        shadows={!narrow}
        camera={{ position: opening.position, fov: 30, near: 0.1, far: 30 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        onCreated={({ camera, gl }) => {
          gl.setClearColor(AIR)
          camera.lookAt(...opening.lookAt)
        }}
      >
        <Scene
          sessions={state.sessions}
          ids={ids}
          activeId={state.activeId}
          reduce={reduce}
          flat={flat}
          narrow={narrow}
          onSelect={onSelect}
        />
      </Canvas>
    </Boundary>
  )
}

export { webglOk }
