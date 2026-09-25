import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import crypto from 'crypto'
import fs from 'fs'
import http from 'http'
import net from 'net'
import os from 'os'
import path from 'path'
import { WebSocket } from 'ws'
import { RelayServer } from '../RelayServer'
import { initDb, closeDb, getDb } from '../db'
import { hashPat } from '../middleware/auth'
import { waitForMessage, waitForOpen } from '@tapflowio/test-utils'
import type { AgentRegistered } from '@tapflowio/protocol'

// The tunnel listener exists because a tunnel client — rathole, `tailscale serve` — connects from
// loopback on behalf of someone on the internet or the tailnet. Every test here connects from loopback
// for real, which is exactly the situation: the only thing that differs between the two ports is the
// listener, so a pass on one and a refusal on the other is the property itself.

interface HttpResult { status: number; body: { error?: string; ok?: boolean; initialized?: boolean; canInitialize?: boolean } }

function request(port: number, method: string, urlPath: string, payload?: unknown, headers: Record<string, string> = {}): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const data = payload === undefined ? '' : JSON.stringify(payload)
    const req = http.request(
      { hostname: '127.0.0.1', port, path: urlPath, method, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers } },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(Buffer.concat(chunks).toString() || '{}') as HttpResult['body'] }))
      },
    )
    req.on('error', reject)
    req.end(data)
  })
}

const closeOf = (ws: WebSocket) =>
  new Promise<number>((resolve) => ws.once('close', (code) => resolve(code)))

const register = (ws: WebSocket, agentName: string) =>
  ws.send(JSON.stringify({ type: 'agent:register', platform: 'ios', agentName, devices: [{ id: 'devA', name: 'iPhone A', platform: 'ios', status: 'shutdown' }] }))

const userCount = () => (getDb().prepare('SELECT COUNT(*) as n FROM users').get() as { n: number }).n

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer()
    probe.once('error', reject)
    probe.listen({ port: 0, host: '::', ipv6Only: false }, () => {
      const { port } = probe.address() as net.AddressInfo
      probe.close(() => resolve(port))
    })
  })
}

function canListen(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = net.createServer()
    probe.once('error', () => resolve(false))
    probe.listen({ port, host }, () => probe.close(() => resolve(true)))
  })
}

describe('RelayServer tunnel listener', () => {
  let tmpDir: string

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tapflow-tunnel-ingress-'))
    initDb(path.join(tmpDir, 'test.db'))
  })

  afterAll(() => {
    closeDb()
    fs.rmSync(tmpDir, { recursive: true })
  })

  beforeEach(() => {
    getDb().prepare('DELETE FROM personal_access_tokens').run()
    getDb().prepare('DELETE FROM users').run()
  })

  describe('when a tunnel port is given', () => {
    let server: RelayServer
    let relayPort: number
    let tunnelPort: number

    const start = async (options: { trustedProxies?: string[] } = {}) => {
      server = new RelayServer({ port: 0, tunnelPort: 0, ...options })
      await server.start()
      relayPort = (server.address() as net.AddressInfo).port
      tunnelPort = (server.tunnelAddress() as net.AddressInfo).port
    }

    afterEach(async () => { await server.stop() })

    it('listens on loopback only, on a port of its own', async () => {
      await start()
      const addr = server.tunnelAddress() as net.AddressInfo
      expect(addr.address).toBe('127.0.0.1')
      expect(addr.port).not.toBe(relayPort)
    })

    it('serves the same routes as the relay port', async () => {
      await start()
      const r = await request(tunnelPort, 'GET', '/api/v1/auth/status')
      expect(r.status).toBe(200)
      expect(r.body.initialized).toBe(false)
    })

    it('refuses a socket with no credentials, which the relay port accepts as local', async () => {
      await start()

      const viaTunnel = new WebSocket(`ws://127.0.0.1:${tunnelPort}`)
      expect(await closeOf(viaTunnel)).toBe(1008)

      const direct = new WebSocket(`ws://127.0.0.1:${relayPort}`)
      await waitForOpen(direct)
      register(direct, 'TunnelIngress-local')
      const msg = await waitForMessage<AgentRegistered>(direct)
      expect(msg.type).toBe('agent:registered')
      direct.close()
    })

    it('accepts an agent that presents an agent-scope token', async () => {
      await start()
      const raw = `tflw_pat_${crypto.randomBytes(16).toString('hex')}`
      getDb().prepare("INSERT INTO users (id, email, display_name, role, password_hash) VALUES (7101, 'tunnel-agent@test.local', 'Tunnel Agent', 'Admin', 'x')").run()
      getDb().prepare('INSERT INTO personal_access_tokens (user_id, name, token_hash, scope) VALUES (7101, ?, ?, ?)').run('tunnel', hashPat(raw), 'agent')

      const ws = new WebSocket(`ws://127.0.0.1:${tunnelPort}`, { headers: { authorization: `Bearer ${raw}` } })
      await waitForOpen(ws)
      register(ws, 'TunnelIngress-token')
      const msg = await waitForMessage<AgentRegistered>(ws)
      expect(msg.type).toBe('agent:registered')
      ws.close()
    })

    it('refuses first-admin setup through the tunnel and allows it on the relay port', async () => {
      await start()
      expect((await request(tunnelPort, 'GET', '/api/v1/auth/status')).body.canInitialize).toBe(false)
      expect((await request(relayPort, 'GET', '/api/v1/auth/status')).body.canInitialize).toBe(true)
      const viaTunnel = await request(tunnelPort, 'POST', '/api/v1/auth/init', { email: 'evil@example.com', password: 'password123' })
      expect(viaTunnel.status).toBe(403)
      expect(userCount()).toBe(0)

      const direct = await request(relayPort, 'POST', '/api/v1/auth/init', { email: 'admin@example.com', password: 'password123' })
      expect(direct.status).toBe(201)
    })

    // With the loopback proxy trusted, a forwarded `::1` resolves to a loopback client — local on the relay
    // port. Arriving through the tunnel, the same request is remote whatever the header says.
    it('keeps a forwarded loopback client remote when the proxy is trusted', async () => {
      await start({ trustedProxies: ['127.0.0.1'] })
      const viaTunnel = await request(tunnelPort, 'POST', '/api/v1/auth/init', { email: 'evil@example.com', password: 'password123' }, { 'X-Forwarded-For': '::1' })
      expect(viaTunnel.status).toBe(403)

      const direct = await request(relayPort, 'POST', '/api/v1/auth/init', { email: 'admin@example.com', password: 'password123' }, { 'X-Forwarded-For': '::1' })
      expect(direct.status).toBe(201)
    })
  })

  it('releases both ports on stop()', async () => {
    const server = new RelayServer({ port: 0, tunnelPort: 0 })
    await server.start()
    const relayPort = (server.address() as net.AddressInfo).port
    const tunnelPort = (server.tunnelAddress() as net.AddressInfo).port
    await server.stop()
    expect(await canListen(relayPort, '::')).toBe(true)
    expect(await canListen(tunnelPort, '127.0.0.1')).toBe(true)
  })

  it('opens no tunnel listener unless asked', async () => {
    const server = new RelayServer({ port: 0 })
    await server.start()
    try {
      expect(server.tunnelAddress()).toBeNull()
    } finally {
      await server.stop()
    }
  })

  it('refuses a tunnel port equal to the relay port', () => {
    expect(() => new RelayServer({ port: 4555, tunnelPort: 4555 })).toThrow(/TAPFLOW_TUNNEL_PORT/)
  })

  it('fails to start when the tunnel port is taken, naming the setting, and gives the relay port back', async () => {
    const holder = net.createServer()
    await new Promise<void>((resolve) => holder.listen({ port: 0, host: '127.0.0.1' }, resolve))
    const taken = (holder.address() as net.AddressInfo).port
    const relayPort = await freePort()
    const server = new RelayServer({ port: relayPort, tunnelPort: taken })
    try {
      await expect(server.start()).rejects.toThrow(new RegExp(`${taken}.*TAPFLOW_TUNNEL_PORT`))
      expect(await canListen(relayPort, '::')).toBe(true)
    } finally {
      await new Promise<void>((resolve) => holder.close(() => resolve()))
    }
  })
})
