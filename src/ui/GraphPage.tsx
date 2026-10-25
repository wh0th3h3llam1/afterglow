import { useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph3D, { type ForceGraphMethods } from 'react-force-graph-3d'
import type { GraphEdge, GraphNode } from '../hall/types'
import { AgentNotice } from './AgentNotice'
import { Mark } from './Mark'
import { VoiceButton } from './VoiceButton'

type Picture = { nodes: GraphNode[]; edges: GraphEdge[] }
type GNode = { id: string; name: string; label: string }
type GLink = { source: string; target: string; type: string }

const NODE_COLOR: Record<string, string> = {
  Person: '#e46aa8',
  Organization: '#e0a04a',
  Conversation: '#6ea2ff',
  Topic: '#7ec8e3',
  Promise: '#3cbe78',
  Talk: '#c47a4a',
  Event: '#d7c4a3',
}

export function GraphPage({ onText }: { onText: (text: string) => void }) {
  const [picture, setPicture] = useState<Picture | null>(null)
  const [error, setError] = useState('')
  const [hidden, setHidden] = useState<string[]>([])
  const [size, setSize] = useState({ width: 0, height: 0 })
  const stage = useRef<HTMLDivElement>(null)
  const graphRef = useRef<ForceGraphMethods<GNode, GLink> | undefined>(undefined)
  const fitted = useRef('')

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/graph', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('down')
        return response.json()
      })
      .then((data) => {
        setPicture({
          nodes: Array.isArray(data?.nodes) ? data.nodes : [],
          edges: Array.isArray(data?.edges) ? data.edges : [],
        })
      })
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setError('The conference graph did not load.')
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const node = stage.current
    if (!node) return
    const measure = () => setSize({ width: node.clientWidth, height: node.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [picture])

  const types = useMemo(
    () => [...new Set((picture?.edges ?? []).map((edge) => edge.type))].sort(),
    [picture],
  )

  const graphData = useMemo(() => {
    const nodes: GNode[] = (picture?.nodes ?? []).map((node) => ({
      id: node.id,
      name: node.name,
      label: node.label,
    }))
    const links: GLink[] = (picture?.edges ?? [])
      .filter((edge) => !hidden.includes(edge.type))
      .map((edge) => ({ source: edge.from, target: edge.to, type: edge.type }))
    return { nodes, links }
  }, [picture, hidden])

  return (
    <main className="graph-page">
      <header>
        <a href="#hall">
          <Mark />
          Hall
        </a>
        <h1>Conference graph</h1>
        <div className="top-tools">
          <VoiceButton onText={onText} />
          <AgentNotice />
        </div>
      </header>
      {error && <p className="graph-status">{error}</p>}
      {!picture && !error && <p className="graph-status">Reading the graph…</p>}
      {picture && picture.nodes.length === 0 && <p className="graph-status">The graph is empty.</p>}
      {picture && picture.nodes.length > 0 && (
        <>
          <div className="edge-toggles" role="group" aria-label="Edge types">
            {types.map((type) => {
              const on = !hidden.includes(type)
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={on}
                  className={on ? 'on' : ''}
                  onClick={() =>
                    setHidden((current) =>
                      current.includes(type) ? current.filter((item) => item !== type) : [...current, type],
                    )
                  }
                >
                  {type}
                </button>
              )
            })}
          </div>
          <p className="graph-status">Drag to turn. Scroll to zoom. Right-drag to move.</p>
          <div className="graph-stage" ref={stage}>
            {size.width > 0 && (
              <ForceGraph3D
                ref={graphRef}
                width={size.width}
                height={size.height}
                backgroundColor="#141311"
                graphData={graphData}
                nodeLabel={(node) => `${node.name} (${node.label})`}
                nodeColor={(node) => NODE_COLOR[node.label] ?? '#b7b1a6'}
                linkColor={() => 'rgba(230, 225, 216, 0.45)'}
                linkWidth={0.4}
                linkDirectionalParticles={0}
                dagMode="radialout"
                dagLevelDistance={48}
                controlType="orbit"
                enableNavigationControls
                enableNodeDrag
                showNavInfo={false}
                onEngineStop={() => {
                  const key = `${graphData.nodes.length}:${graphData.links.length}`
                  if (fitted.current === key) return
                  fitted.current = key
                  graphRef.current?.zoomToFit(700, 80)
                }}
              />
            )}
          </div>
        </>
      )}
    </main>
  )
}
