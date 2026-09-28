const crypto = require('crypto')
const http = require('http')
const { WebSocketServer, WebSocket } = require('ws')

const PORT = Number(process.env.PORT || 8080)
const TENANT_API_URL = String(process.env.TENANT_API_URL || '').trim()
const PRINT_PUSH_GATEWAY_SECRET = String(process.env.PRINT_PUSH_GATEWAY_SECRET || '').trim()
const MAX_BODY_BYTES = 64 * 1024
const AUTH_TIMEOUT_MS = 8 * 1000
const API_TIMEOUT_MS = 8 * 1000

if (!TENANT_API_URL) {
  throw new Error('TENANT_API_URL is required')
}
if (!PRINT_PUSH_GATEWAY_SECRET) {
  throw new Error('PRINT_PUSH_GATEWAY_SECRET is required')
}

const clientsByStore = new Map()
const wss = new WebSocketServer({ noServer: true, clientTracking: false })

function safeEqual(left, right) {
  const first = Buffer.from(String(left || ''))
  const second = Buffer.from(String(right || ''))
  return first.length === second.length && crypto.timingSafeEqual(first, second)
}

function sendJson(response, statusCode, value) {
  const body = JSON.stringify(value)
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  })
  response.end(body)
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let raw = ''
    let size = 0
    request.on('data', chunk => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('request body too large'))
        request.destroy()
        return
      }
      raw += chunk.toString('utf8')
    })
    request.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch (_) {
        reject(new Error('invalid json'))
      }
    })
    request.on('error', reject)
  })
}

async function callTenantApi(payload) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS)
  try {
    const response = await fetch(TENANT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    })
    const data = await response.json()
    if (!response.ok || !data || data.success !== true) {
      throw new Error(data && data.message || `tenant api http ${response.status}`)
    }
    return data.data || {}
  } finally {
    clearTimeout(timer)
  }
}

function addClient(storeId, socket) {
  const clients = clientsByStore.get(storeId) || new Set()
  clients.add(socket)
  clientsByStore.set(storeId, clients)
}

function removeClient(storeId, socket) {
  if (!storeId) return
  const clients = clientsByStore.get(storeId)
  if (!clients) return
  clients.delete(socket)
  if (clients.size === 0) clientsByStore.delete(storeId)
}

function notifyStore(storeId, event) {
  const clients = clientsByStore.get(storeId)
  if (!clients) return 0
  const message = JSON.stringify(event)
  let receivers = 0
  clients.forEach(socket => {
    if (socket.readyState !== WebSocket.OPEN) return
    socket.send(message)
    receivers += 1
  })
  return receivers
}

async function authorizeSocket(socket, rawMessage, state) {
  if (state.authorized || state.authenticating) return
  state.authenticating = true
  let message
  try {
    message = JSON.parse(rawMessage.toString())
  } catch (_) {
    socket.close(1008, 'invalid hello')
    return
  }

  if (message.type !== 'hello' || !message.tenantId || !message.agentId || !message.agentToken) {
    socket.close(1008, 'agent authentication required')
    return
  }

  try {
    const agent = await callTenantApi({
      tenantId: String(message.tenantId),
      action: 'print.agent.websocketAuth',
      agentId: String(message.agentId),
      agentToken: String(message.agentToken)
    })
    if (!agent.storeId || agent.storeId !== String(message.tenantId)) {
      throw new Error('agent store mismatch')
    }
    state.authorized = true
    state.storeId = agent.storeId
    addClient(state.storeId, socket)
    socket.send(JSON.stringify({ type: 'ready', storeId: state.storeId }))
  } catch (error) {
    socket.close(1008, String(error && error.message || 'agent authentication failed').slice(0, 120))
  } finally {
    state.authenticating = false
  }
}

wss.on('connection', socket => {
  const state = { authorized: false, authenticating: false, storeId: '' }
  const authTimer = setTimeout(() => {
    if (!state.authorized) socket.close(1008, 'authentication timeout')
  }, AUTH_TIMEOUT_MS)

  socket.on('message', rawMessage => {
    if (!state.authorized) {
      void authorizeSocket(socket, rawMessage, state)
      return
    }
    try {
      const message = JSON.parse(rawMessage.toString())
      if (message.type === 'ping') socket.send(JSON.stringify({ type: 'pong' }))
    } catch (_) {
      // Ignore malformed messages after the authenticated handshake.
    }
  })
  socket.on('close', () => {
    clearTimeout(authTimer)
    removeClient(state.storeId, socket)
  })
  socket.on('error', () => {
    removeClient(state.storeId, socket)
  })
})

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || '/', 'http://localhost')
  if (request.method === 'GET' && url.pathname === '/health') {
    sendJson(response, 200, {
      success: true,
      stores: clientsByStore.size,
      connections: Array.from(clientsByStore.values()).reduce((sum, clients) => sum + clients.size, 0)
    })
    return
  }

  if (request.method === 'POST' && url.pathname === '/notify') {
    const providedSecret = request.headers['x-print-push-secret']
    if (!safeEqual(providedSecret, PRINT_PUSH_GATEWAY_SECRET)) {
      sendJson(response, 401, { success: false, message: 'unauthorized' })
      return
    }
    try {
      const payload = await readJson(request)
      const storeId = String(payload.storeId || payload.tenantId || '').trim()
      if (!storeId) {
        sendJson(response, 400, { success: false, message: 'storeId is required' })
        return
      }
      const receivers = notifyStore(storeId, {
        type: 'print_job_available',
        jobId: String(payload.jobId || ''),
        printerId: String(payload.printerId || ''),
        ticketType: String(payload.ticketType || '')
      })
      sendJson(response, 200, { success: true, receivers })
    } catch (error) {
      sendJson(response, 400, { success: false, message: error.message || 'invalid request' })
    }
    return
  }

  sendJson(response, 404, { success: false, message: 'not found' })
})

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url || '/', 'http://localhost')
  if (url.pathname !== '/ws') {
    socket.destroy()
    return
  }
  wss.handleUpgrade(request, socket, head, webSocket => {
    wss.emit('connection', webSocket, request)
  })
})

server.listen(PORT, () => {
  console.log(`print push gateway listening on ${PORT}`)
})
