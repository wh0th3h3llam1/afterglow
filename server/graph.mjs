import { readFileSync } from 'node:fs'
import { FalkorDB } from 'falkordb'
import { loadEnv } from './env.mjs'

const catalog = JSON.parse(readFileSync(new URL('../src/hall/catalog.json', import.meta.url), 'utf8'))

loadEnv()

const PATH_QUERY = `
MATCH p = (me:Person {role:'self'})-[:MET]->(who:Person)-[:WORKS_AT]->(org:Organization)
MATCH (talk:Conversation)-[:DISCUSSED]->(topic:Topic)
WHERE (talk)-[:WITH]->(who)
RETURN p, who.name AS who, org.name AS org, topic.name AS topic
LIMIT 1
`

let dbPromise
let graphName = process.env.FALKORDB_GRAPH || 'conference'

export function activeGraphName() {
  return graphName
}

async function connect() {
  if (!process.env.FALKORDB_HOST || !process.env.FALKORDB_PASSWORD) {
    throw new Error('FalkorDB host or password is missing on the server')
  }
  const tls = process.env.FALKORDB_TLS !== 'false'
  return FalkorDB.connect({
    username: process.env.FALKORDB_USERNAME || 'falkordb',
    password: process.env.FALKORDB_PASSWORD,
    socket: {
      host: process.env.FALKORDB_HOST,
      port: Number(process.env.FALKORDB_PORT || 50413),
      tls,
      connectTimeout: 15000,
    },
  })
}

export async function database() {
  if (!dbPromise) dbPromise = connect()
  return dbPromise
}

export async function closeDatabase() {
  if (!dbPromise) return
  const db = await dbPromise
  dbPromise = undefined
  await db.close()
}

async function graph() {
  const db = await database()
  return db.selectGraph(graphName)
}

function field(row, index, name) {
  if (row == null) return undefined
  if (Array.isArray(row)) return row[index]
  if (name && Object.prototype.hasOwnProperty.call(row, name)) return row[name]
  const values = Object.values(row)
  return values[index]
}

function rowsOf(result) {
  if (!result) return []
  if (Array.isArray(result.data)) return result.data
  if (Array.isArray(result)) return result
  return []
}

export function describePath(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value
  const nodes = value.nodes || value._nodes
  const edges = value.edges || value.relationships || value._edges
  if (Array.isArray(nodes) && nodes.length) {
    const parts = []
    nodes.forEach((node, index) => {
      const labels = node.labels || node.label || ''
      const label = Array.isArray(labels) ? labels.join(':') : String(labels)
      const name = node.properties?.name || node.properties?.role || label
      parts.push(`(${label}${name ? ' ' + name : ''})`)
      const edge = Array.isArray(edges) ? edges[index] : null
      const type = edge?.type || edge?.relationshipType || edge?.properties?.type
      if (type) parts.push(`-[:${type}]->`)
    })
    return parts.join('')
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export async function seedConference() {
  const db = await database()
  try {
    await db.selectGraph('conference').query('RETURN 1')
    graphName = 'conference'
  } catch (error) {
    const message = String(error?.message || error)
    if (/lab|not allowed|permission|unknown graph/i.test(message)) {
      graphName = 'lab'
    } else {
      graphName = 'conference'
    }
  }
  const g = await graph()
  await g.query(`
    MERGE (me:Person {role:'self'})
    SET me.name = 'You'
    MERGE (agent:Talk {name:'Agent talk'})
    MERGE (orgTalk:Talk {name:'Nimbus'})
  `)
  const events = new Map(catalog.events.map((event) => [event.id, event]))
  for (const person of catalog.people) {
    const event = events.get(person.eventId) || { id: person.eventId, name: person.eventId, date: '', venue: '' }
    await g.query(
      `
      MERGE (me:Person {role:'self'})
      MERGE (who:Person {id:$id})
      SET who.name = $who, who.email = $email
      MERGE (org:Organization {name:$company})
      MERGE (topic:Topic {name:$subject})
      MERGE (talk:Conversation {name:$talkName})
      MERGE (event:Event {id:$eventId})
      SET event.name = $eventName, event.date = $date, event.venue = $venue
      MERGE (me)-[:MET]->(who)
      MERGE (who)-[:WORKS_AT]->(org)
      MERGE (who)-[:ATTENDED]->(event)
      MERGE (talk)-[:DISCUSSED]->(topic)
      MERGE (talk)-[:WITH]->(who)
      MERGE (talk)-[:ABOUT]->(topic)
      `,
      {
        params: {
          id: person.id,
          who: person.name,
          email: person.email || '',
          company: person.org,
          subject: person.topic,
          talkName: `Talk with ${person.name} at ${event.name}`,
          eventId: event.id,
          eventName: event.name,
          date: event.date,
          venue: event.venue,
        },
      },
    )
    await g.query(
      `
      MATCH (who:Person {id:$id})
      OPTIONAL MATCH (who)-[oldOrg:WORKS_AT]->(other:Organization)
      WHERE other.name <> $company
      DELETE oldOrg
      WITH who
      OPTIONAL MATCH (extra:Conversation)-[oldTalk:WITH]->(who)
      WHERE extra.name <> $talkName
      DELETE oldTalk
      `,
      { params: { id: person.id, company: person.org, talkName: `Talk with ${person.name} at ${event.name}` } },
    )
    if (/introduc/i.test(person.note || '')) {
      await g.query(
        `
        MATCH (who:Person {id:$id})
        MERGE (introPromise:Promise {name:'intro'})
        ON CREATE SET introPromise.status = 'open'
        MERGE (who)-[:OFFERED]->(introPromise)
        `,
        { params: { id: person.id } },
      )
    }
  }
  return { graph: graphName }
}

export async function rememberMeeting({ id, name, org, topic, email, intro, owe }) {
  await seedConference()
  const g = await graph()
  const who = name || 'Someone'
  const personId = id || who
  const company = org || 'Unknown'
  const subject = topic || 'the conversation'
  await g.query(
    `
    MERGE (me:Person {role:'self'})
    SET me.name = 'You'
    MERGE (who:Person {id:$id})
    SET who.name = $who, who.email = $email
    MERGE (org:Organization {name:$company})
    MERGE (topic:Topic {name:$subject})
    MERGE (talk:Conversation {name:$talkName})
    MERGE (repo:Promise {name:$owe})
    ON CREATE SET repo.status = 'open'
    MERGE (agent:Talk {name:'Agent talk'})
    MERGE (orgTalk:Talk {name:$company})
    MERGE (me)-[:MET]->(who)
    MERGE (who)-[:WORKS_AT]->(org)
    MERGE (talk)-[:DISCUSSED]->(topic)
    MERGE (talk)-[:WITH]->(who)
    MERGE (talk)-[:ABOUT]->(topic)
    MERGE (talk)-[:AFTER]->(agent)
    MERGE (org)-[:AFTER]->(orgTalk)
    MERGE (me)-[:OWES]->(repo)
    `,
    { params: { id: personId, who, company, subject, email: email || '', talkName: `Talk with ${who}`, owe: owe || 'the repo' } },
  )
  if (intro) {
    await g.query(
      `
      MATCH (who:Person {id:$id})
      MERGE (introPromise:Promise {name:'intro'})
      ON CREATE SET introPromise.status = 'open'
      MERGE (who)-[:OFFERED]->(introPromise)
      `,
      { params: { id: personId } },
    )
  }
  return explainFollowup(who, personId)
}

export async function explainFollowup(name, id) {
  await seedConference()
  const g = await graph()
  const query = id || name
    ? `
MATCH p = (me:Person {role:'self'})-[:MET]->(who:Person {${id ? 'id:$id' : 'name:$name'}})-[:WORKS_AT]->(org:Organization)
MATCH (talk:Conversation)-[:DISCUSSED]->(topic:Topic)
WHERE (talk)-[:WITH]->(who)
RETURN p, who.name AS who, org.name AS org, topic.name AS topic
LIMIT 1
`
    : PATH_QUERY
  const result = await g.query(query, id ? { params: { id } } : name ? { params: { name } } : undefined)
  const row = rowsOf(result)[0]
  if (!row) return null
  const path = field(row, 0, 'p')
  const who = field(row, 1, 'who') || name || 'them'
  const org = field(row, 2, 'org') || 'their org'
  const topic = field(row, 3, 'topic') || 'the conversation'
  const picture = await neighborhood(String(who), String(topic))
  return {
    chain: `You met ${who} · ${who} at ${org} · talked about ${String(topic).toLowerCase()} · you owe the repo`,
    raw: describePath(path),
    nodes: picture.nodes,
    edges: picture.edges,
    source: 'graph',
    graph: graphName,
  }
}

function asNode(value) {
  if (!value || typeof value !== 'object' || !value.labels) return null
  const label = Array.isArray(value.labels) ? value.labels[0] : 'Node'
  const raw = value.properties?.name || (value.properties?.role === 'self' ? 'You' : label)
  const name = label === 'Topic' ? String(raw).toLowerCase() : String(raw)
  const key = value.properties?.id || name
  return { id: `${label}:${key}`, label, name }
}

async function neighborhood(name, topicName) {
  const g = await graph()
  const result = await g.query(
    `
    MATCH (me:Person {role:'self'})-[:MET]->(who:Person {name:$name})
    OPTIONAL MATCH (who)-[:WORKS_AT]->(org:Organization)
    OPTIONAL MATCH (talk:Conversation)-[:WITH]->(who)
    OPTIONAL MATCH (talk)-[:DISCUSSED]->(topic:Topic)
    WHERE toLower(topic.name) = toLower($topic)
    OPTIONAL MATCH (me)-[:OWES]->(promise:Promise)
    WHERE promise.name = 'the repo'
    OPTIONAL MATCH (who)-[:OFFERED]->(intro:Promise)
    WHERE intro.name = 'intro'
    RETURN me, who, org, talk, topic, promise, intro
    LIMIT 4
    `,
    { params: { name, topic: topicName } },
  )
  const nodes = []
  const edges = []
  const seenNodes = new Set()
  const seenEdges = new Set()
  const addNode = (node) => {
    if (!node || seenNodes.has(node.id)) return node
    seenNodes.add(node.id)
    nodes.push(node)
    return node
  }
  const addEdge = (from, to, type) => {
    if (!from || !to) return
    const key = `${from.id}|${type}|${to.id}`
    if (seenEdges.has(key)) return
    seenEdges.add(key)
    edges.push({ from: from.id, to: to.id, type })
  }
  for (const row of rowsOf(result)) {
    const me = addNode(asNode(field(row, 0, 'me')))
    const who = addNode(asNode(field(row, 1, 'who')))
    const org = addNode(asNode(field(row, 2, 'org')))
    const talk = addNode(asNode(field(row, 3, 'talk')))
    const topic = addNode(asNode(field(row, 4, 'topic')))
    const promise = addNode(asNode(field(row, 5, 'promise')))
    const intro = addNode(asNode(field(row, 6, 'intro')))
    addEdge(me, who, 'MET')
    addEdge(who, org, 'WORKS_AT')
    addEdge(talk, who, 'WITH')
    addEdge(talk, topic, 'DISCUSSED')
    addEdge(me, promise, 'OWES')
    addEdge(who, intro, 'OFFERED')
  }
  return { nodes, edges }
}

const ASK_STOP = new Set([
  'the', 'and', 'you', 'met', 'about', 'from', 'with', 'their', 'what', 'who', 'did', 'how', 'for', 'that', 'this',
  'they', 'her', 'his', 'was', 'are', 'owe', 'owes', 'someone', 'somebody', 'tell', 'show', 'where', 'when', 'which',
])

export async function askGraph(question) {
  await seedConference()
  const tokens = String(question || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !ASK_STOP.has(word))
  if (!tokens.length) return { sentence: 'Name a person, a company, or a topic.', people: [] }
  const g = await graph()
  const result = await g.query(`
    MATCH (me:Person {role:'self'})-[:MET]->(who:Person)
    OPTIONAL MATCH (who)-[:WORKS_AT]->(org:Organization)
    OPTIONAL MATCH (who)-[:ATTENDED]->(event:Event)
    OPTIONAL MATCH (talk:Conversation)-[:WITH]->(who)
    OPTIONAL MATCH (talk)-[:DISCUSSED]->(topic:Topic)
    RETURN who.id AS id, who.name AS name, org.name AS org, topic.name AS topic,
           event.name AS conference, event.venue AS venue, event.date AS date
    LIMIT 200
  `)
  const hit = (value) => {
    const text = String(value || '').toLowerCase()
    return text !== '' && tokens.some((token) => text.includes(token))
  }
  const byId = new Map()
  for (const row of rowsOf(result)) {
    const name = field(row, 1, 'name')
    if (!name) continue
    const id = field(row, 0, 'id') || `${name}:${field(row, 2, 'org') || ''}`
    const org = field(row, 2, 'org')
    const topic = field(row, 3, 'topic')
    const conference = field(row, 4, 'conference')
    const venue = field(row, 5, 'venue')
    const date = field(row, 6, 'date')
    if (!hit(name) && !hit(org) && !hit(topic) && !hit(conference) && !hit(venue)) continue
    const current = byId.get(id) || {
      id: String(id),
      name: String(name),
      org: '',
      conference: '',
      venue: '',
      date: '',
      topics: new Set(),
    }
    if (org) current.org = String(org)
    if (conference) current.conference = String(conference)
    if (venue) current.venue = String(venue)
    if (date) current.date = String(date)
    if (topic) current.topics.add(String(topic))
    byId.set(id, current)
  }
  const found = [...byId.values()]
  const withEvent = found.filter((person) => person.conference)
  const people = withEvent.length ? withEvent : found
  if (!people.length) return { sentence: 'Nothing in the conference graph matches that.', people: [] }
  const sentence = people
    .map((person) => {
      const place = person.org ? ` from ${person.org}` : ''
      const where = person.conference ? ` at ${person.conference}` : ''
      const topic = [...person.topics][0]
      const bits = [`You met ${person.name}${place}${where}.`]
      if (topic) bits.push(`You talked about ${String(topic).toLowerCase()}.`)
      return bits.join(' ')
    })
    .join(' ')
  return {
    sentence,
    people: people.map(({ topics, ...person }) => person),
  }
}

export async function wholeGraph() {
  await seedConference()
  const g = await graph()
  const result = await g.query(`
    MATCH (a)-[r]->(b)
    RETURN a, type(r) AS rel, b
    LIMIT 800
  `)
  const nodes = []
  const edges = []
  const seenNodes = new Set()
  const seenEdges = new Set()
  for (const row of rowsOf(result)) {
    const from = asNode(field(row, 0, 'a'))
    const to = asNode(field(row, 2, 'b'))
    const rel = String(field(row, 1, 'rel') || 'RELATED')
    if (from && !seenNodes.has(from.id)) {
      seenNodes.add(from.id)
      nodes.push(from)
    }
    if (to && !seenNodes.has(to.id)) {
      seenNodes.add(to.id)
      nodes.push(to)
    }
    if (!from || !to) continue
    const key = `${from.id}|${rel}|${to.id}`
    if (seenEdges.has(key)) continue
    seenEdges.add(key)
    edges.push({ from: from.id, to: to.id, type: rel })
  }
  return { nodes, edges }
}

export async function openOwes() {
  await seedConference()
  const g = await graph()
  const result = await g.query(`
    MATCH (me:Person {role:'self'})-[:OWES]->(promise:Promise)
    WHERE promise.status IS NULL OR promise.status = 'open'
    RETURN promise.name AS name
  `)
  return rowsOf(result).map((row) => field(row, 0, 'name')).filter(Boolean)
}

export async function closeRepoIfLinked(body, url) {
  if (!url || !body?.includes(url)) return { closed: false }
  await seedConference()
  const g = await graph()
  await g.query(
    `
    MATCH (me:Person {role:'self'})-[edge:OWES]->(promise:Promise {name:'the repo'})
    SET promise.status = 'kept'
    `,
  )
  return { closed: true }
}

export async function counts() {
  await seedConference()
  const g = await graph()
  const ping = await g.query('RETURN 1 AS ok')
  const nodes = await g.query('MATCH (n) RETURN count(n) AS n')
  const edges = await g.query('MATCH ()-[r]->() RETURN count(r) AS n')
  const path = await explainFollowup()
  return {
    graph: graphName,
    ping: rowsOf(ping).length > 0,
    nodes: Number(field(rowsOf(nodes)[0], 0, 'n') || 0),
    edges: Number(field(rowsOf(edges)[0], 0, 'n') || 0),
    path: Boolean(path),
    sample: path,
  }
}
