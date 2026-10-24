import { closeDatabase, counts, rememberMeeting } from './graph.mjs'

const seeded = await rememberMeeting({
  name: 'Priya',
  org: 'Nimbus',
  topic: 'agent memory',
  email: 'priya@nimbus.example',
  intro: true,
})
const report = await counts()
const ok = report.ping && report.nodes > 0 && report.edges > 0 && report.path
console.log(JSON.stringify({ ok, graph: report.graph, ping: report.ping, nodes: report.nodes, edges: report.edges, path: report.path, chain: seeded?.chain ?? report.sample?.chain, raw: seeded?.raw ?? report.sample?.raw }, null, 2))
await closeDatabase()
if (!ok) process.exit(1)
