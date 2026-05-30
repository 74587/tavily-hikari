type DemoHaState = {
  haStatus: {
    mode: string
    nodeId: string
    nodePublicOrigin: string | null
    role: string
    degraded: boolean
    allowsBasicBusiness: boolean
    allowsFullWrites: boolean
    edgeoneDomain: string | null
    edgeoneOrigin: string | null
    edgeoneExpectedOrigin: string | null
    edgeoneApiConfigured: boolean
    lastEdgeoneCheckAt: number | null
    lastSyncAt: number | null
    syncLagSeconds: number | null
    recoveryStatus: string | null
    message: string | null
  }
}

function jsonResponse(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  })
}

export function createDemoHaStatus(nowSeconds: (offset?: number) => number): DemoHaState['haStatus'] {
  return {
    mode: 'active_standby',
    nodeId: 'demo-standby',
    nodePublicOrigin: '203.0.113.10:58087',
    role: 'provisional_master',
    degraded: true,
    allowsBasicBusiness: true,
    allowsFullWrites: false,
    edgeoneDomain: 'api.example.com',
    edgeoneOrigin: '203.0.113.10:58087',
    edgeoneExpectedOrigin: '203.0.113.9:58087',
    edgeoneApiConfigured: true,
    lastEdgeoneCheckAt: nowSeconds(-10),
    lastSyncAt: nowSeconds(-8),
    syncLagSeconds: 8,
    recoveryStatus: null,
    message: 'demo failover is waiting for administrator finalize',
  }
}

export function handleDemoHaRoute(path: string, method: string, state: DemoHaState): Response | null {
  if (path === '/api/ha/status' || path === '/api/admin/ha/status') return jsonResponse(state.haStatus)
  if (path === '/api/admin/ha/promote' && method === 'POST') {
    state.haStatus = {
      ...state.haStatus,
      role: 'provisional_master',
      allowsBasicBusiness: true,
      allowsFullWrites: false,
      edgeoneOrigin: state.haStatus.nodePublicOrigin,
      message: 'demo promote completed; finalize required',
    }
    return jsonResponse(state.haStatus)
  }
  if (path === '/api/admin/ha/finalize' && method === 'POST') {
    state.haStatus = {
      ...state.haStatus,
      role: 'full_master',
      degraded: false,
      allowsBasicBusiness: true,
      allowsFullWrites: true,
      message: 'demo failover finalized',
    }
    return jsonResponse(state.haStatus)
  }
  return null
}
