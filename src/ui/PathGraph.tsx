import type { GraphEdge, GraphNode } from '../hall/types'

const COLOR: Record<string, string> = {
  Person: '#e46aa8',
  Organization: '#e0a04a',
  Conversation: '#6ea2ff',
  Topic: '#7ec8e3',
  Promise: '#3cbe78',
  Talk: '#c47a4a',
}

type Placed = GraphNode & { x: number; y: number }

function layout(nodes: GraphNode[], edges: GraphEdge[]) {
  const depth = new Map<string, number>()
  const root = nodes.find((node) => node.name === 'You') ?? nodes[0]
  if (root) depth.set(root.id, 0)
  for (let pass = 0; pass < nodes.length; pass += 1) {
    for (const edge of edges) {
      if (depth.has(edge.from) && !depth.has(edge.to)) depth.set(edge.to, (depth.get(edge.from) ?? 0) + 1)
      if (depth.has(edge.to) && !depth.has(edge.from)) depth.set(edge.from, Math.max(0, (depth.get(edge.to) ?? 1) - 1))
    }
  }
  nodes.forEach((node) => {
    if (!depth.has(node.id)) depth.set(node.id, 1)
  })
  const columns = new Map<number, GraphNode[]>()
  nodes.forEach((node) => {
    const column = depth.get(node.id) ?? 0
    const list = columns.get(column) ?? []
    list.push(node)
    columns.set(column, list)
  })
  const maxColumn = Math.max(0, ...columns.keys())
  const maxRows = Math.max(1, ...[...columns.values()].map((list) => list.length))
  const width = 520
  const height = 36 + maxRows * 86
  const placed: Placed[] = []
  columns.forEach((list, column) => {
    list.forEach((node, row) => {
      const x = maxColumn === 0 ? width / 2 : 64 + (column / maxColumn) * (width - 128)
      const span = height - 48
      const y = 28 + ((row + 0.5) * span) / list.length
      placed.push({ ...node, x, y })
    })
  })
  return { placed, width, height }
}

function curve(from: Placed, to: Placed, bend: number) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy) || 1
  const pad = 22
  const x1 = from.x + (dx / length) * pad
  const y1 = from.y + (dy / length) * pad
  const x2 = to.x - (dx / length) * pad
  const y2 = to.y - (dy / length) * pad
  const cx = (x1 + x2) / 2 + (-dy / length) * bend
  const cy = (y1 + y2) / 2 + (dx / length) * bend
  const labelX = 0.25 * x1 + 0.5 * cx + 0.25 * x2
  const labelY = 0.25 * y1 + 0.5 * cy + 0.25 * y2
  return { d: `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`, labelX, labelY }
}

export function PathGraph({
  nodes,
  edges,
  caption,
}: {
  nodes: GraphNode[]
  edges: GraphEdge[]
  caption: string
}) {
  const { placed, width, height } = layout(nodes, edges)
  const at = new Map(placed.map((node) => [node.id, node]))

  return (
    <figure className="path-graph">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={caption}>
        <title>{caption}</title>
        {edges.map((edge, index) => {
          const from = at.get(edge.from)
          const to = at.get(edge.to)
          if (!from || !to) return null
          const bent = curve(from, to, index % 2 === 0 ? 16 : -16)
          return (
            <g key={`${edge.from}-${edge.type}-${edge.to}`} className="path-edge" style={{ animationDelay: `${index * 70}ms` }}>
              <path d={bent.d} pathLength={1} />
              <text x={bent.labelX} y={bent.labelY} textAnchor="middle">
                {edge.type}
              </text>
            </g>
          )
        })}
        {placed.map((node, index) => (
          <g key={node.id} className="path-node" style={{ animationDelay: `${120 + index * 50}ms` }}>
            <circle cx={node.x} cy={node.y} r={16} fill={COLOR[node.label] ?? '#b7b1a6'} />
            <text className="path-kind" x={node.x} y={node.y + 30} textAnchor="middle">
              {node.label}
            </text>
            <text className="path-name" x={node.x} y={node.y + 44} textAnchor="middle">
              {node.name.length > 18 ? `${node.name.slice(0, 17)}…` : node.name}
            </text>
          </g>
        ))}
      </svg>
      <figcaption>{caption}</figcaption>
    </figure>
  )
}
