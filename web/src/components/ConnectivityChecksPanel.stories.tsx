import type { Meta, StoryObj } from '@storybook/react-vite'

import ConnectivityChecksPanel, {
  type ProbeBubbleModel,
  type ProbeButtonModel,
  type ProbeStepStatus,
} from './ConnectivityChecksPanel'

const stepStatusText: Record<ProbeStepStatus, string> = {
  running: 'Running',
  success: 'Connected',
  failed: 'Failed',
  blocked: 'Blocked',
}

const idleProbe: ProbeButtonModel = {
  state: 'idle',
  completed: 0,
  total: 0,
}

interface ConnectivityScenario {
  title: string
  description: string
  mcpProbe: ProbeButtonModel
  apiProbe: ProbeButtonModel
  mcpButtonLabel: string
  apiButtonLabel: string
  probeBubble?: ProbeBubbleModel
  anyProbeRunning?: boolean
}

const scenarios: ConnectivityScenario[] = [
  {
    title: 'Idle',
    description: 'Fresh token detail before the operator runs any connectivity checks.',
    mcpProbe: idleProbe,
    apiProbe: idleProbe,
    mcpButtonLabel: 'Test MCP',
    apiButtonLabel: 'Test API',
  },
  {
    title: 'API Running',
    description: 'API probe is in-flight and keeps the action group locked until all steps settle.',
    mcpProbe: idleProbe,
    apiProbe: { state: 'running', completed: 2, total: 6 },
    mcpButtonLabel: 'Test MCP',
    apiButtonLabel: 'Testing API (2/6)',
    anyProbeRunning: true,
    probeBubble: {
      visible: true,
      anchor: 'api',
      items: [
        { id: 'api-search', label: 'Search endpoint', status: 'success' },
        { id: 'api-extract', label: 'Extract endpoint', status: 'success' },
        { id: 'api-crawl', label: 'Crawl endpoint', status: 'running' },
      ],
    },
  },
  {
    title: 'All Checks Pass',
    description: 'Both transports are reachable and every billable API probe settles cleanly.',
    mcpProbe: { state: 'success', completed: 2, total: 2 },
    apiProbe: { state: 'success', completed: 6, total: 6 },
    mcpButtonLabel: 'MCP Ready',
    apiButtonLabel: 'API Ready',
    probeBubble: {
      visible: true,
      anchor: 'api',
      items: [
        { id: 'api-search', label: 'Search endpoint', status: 'success' },
        { id: 'api-extract', label: 'Extract endpoint', status: 'success' },
        { id: 'api-crawl', label: 'Crawl endpoint', status: 'success' },
        { id: 'api-map', label: 'Map endpoint', status: 'success' },
        { id: 'api-research', label: 'Research request', status: 'success' },
        { id: 'api-research-result', label: 'Research result poll', status: 'success' },
      ],
    },
  },
  {
    title: 'Partial Availability',
    description: 'Connectivity is established, but one downstream check still fails and the rollup stays partial.',
    mcpProbe: { state: 'success', completed: 2, total: 2 },
    apiProbe: { state: 'partial', completed: 6, total: 6 },
    mcpButtonLabel: 'MCP Ready',
    apiButtonLabel: 'API Partial',
    probeBubble: {
      visible: true,
      anchor: 'api',
      items: [
        { id: 'api-search', label: 'Search endpoint', status: 'success' },
        { id: 'api-extract', label: 'Extract endpoint', status: 'success' },
        { id: 'api-crawl', label: 'Crawl endpoint', status: 'success' },
        { id: 'api-map', label: 'Map endpoint', status: 'failed', detail: '500 timeout from mock upstream' },
        { id: 'api-research', label: 'Research request', status: 'success' },
        { id: 'api-research-result', label: 'Research result poll', status: 'success' },
      ],
    },
  },
  {
    title: 'Authentication Failed',
    description: 'The preflight token fetch succeeds, but MCP handshake rejects the user token immediately.',
    mcpProbe: { state: 'failed', completed: 0, total: 2 },
    apiProbe: idleProbe,
    mcpButtonLabel: 'MCP Failed',
    apiButtonLabel: 'Test API',
    probeBubble: {
      visible: true,
      anchor: 'mcp',
      items: [
        { id: 'mcp-ping', label: 'MCP service reachable', status: 'failed', detail: '401 invalid or disabled token' },
      ],
    },
  },
  {
    title: 'Quota Blocked',
    description: 'Quota precheck marks billable MCP work as blocked while still surfacing the remaining non-billable signal.',
    mcpProbe: { state: 'partial', completed: 2, total: 2 },
    apiProbe: idleProbe,
    mcpButtonLabel: 'MCP Blocked',
    apiButtonLabel: 'Test API',
    probeBubble: {
      visible: true,
      anchor: 'mcp',
      items: [
        { id: 'mcp-ping', label: 'MCP service reachable', status: 'blocked', detail: 'Daily quota exhausted for this token' },
        { id: 'mcp-tools-list', label: 'MCP tools discovered', status: 'success' },
      ],
    },
  },
]

function ConnectivityScenarioCard({
  title,
  description,
  mcpProbe,
  apiProbe,
  mcpButtonLabel,
  apiButtonLabel,
  probeBubble,
  anyProbeRunning,
}: ConnectivityScenario): JSX.Element {
  return (
    <article
      style={{
        display: 'grid',
        gap: 18,
        minWidth: 0,
        padding: '20px 22px',
        borderRadius: 24,
        border: '1px solid rgba(148, 163, 184, 0.2)',
        background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.96), rgba(15, 23, 42, 0.88))',
        color: '#e5edf8',
        boxShadow: '0 26px 60px -36px rgba(15, 23, 42, 0.75)',
      }}
    >
      <div style={{ display: 'grid', gap: 6 }}>
        <div
          style={{
            fontSize: '0.76rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'rgba(191, 219, 254, 0.72)',
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: '0.92rem', lineHeight: 1.55, color: 'rgba(226, 232, 240, 0.82)' }}>
          {description}
        </div>
      </div>
      <div className="dark" style={{ minWidth: 0 }}>
        <ConnectivityChecksPanel
          title="Connectivity Checks"
          costHint="Runs a small MCP handshake and the full Tavily API chain against the mock upstream."
          costHintAria="Connectivity check cost hint"
          stepStatusText={stepStatusText}
          mcpButtonLabel={mcpButtonLabel}
          apiButtonLabel={apiButtonLabel}
          mcpProbe={mcpProbe}
          apiProbe={apiProbe}
          probeBubble={probeBubble}
          anyProbeRunning={anyProbeRunning}
        />
      </div>
    </article>
  )
}

function ConnectivityChecksGallery(): JSX.Element {
  return (
    <div
      style={{
        display: 'grid',
        gap: 24,
        padding: 28,
        borderRadius: 28,
        background:
          'radial-gradient(circle at top, rgba(59, 130, 246, 0.12), transparent 32%), linear-gradient(180deg, #020617 0%, #0f172a 100%)',
      }}
    >
      <section style={{ display: 'grid', gap: 8, maxWidth: 760 }}>
        <div
          style={{
            fontSize: '0.78rem',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'rgba(148, 163, 184, 0.92)',
          }}
        >
          Token Detail Fragment
        </div>
        <h2 style={{ margin: 0, fontSize: '1.8rem', lineHeight: 1.12, color: '#f8fafc' }}>
          Connectivity Checks Gallery
        </h2>
        <p style={{ margin: 0, fontSize: '1rem', lineHeight: 1.6, color: 'rgba(226, 232, 240, 0.78)' }}>
          Dedicated Storybook surface for the MCP and API probe controls. It keeps every meaningful probe state in one review
          board and removes the need for separate full-page User Console stories just to inspect these buttons.
        </p>
      </section>
      <div
        style={{
          display: 'grid',
          gap: 18,
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          alignItems: 'start',
        }}
      >
        {scenarios.map((scenario) => (
          <ConnectivityScenarioCard key={scenario.title} {...scenario} />
        ))}
      </div>
    </div>
  )
}

const meta = {
  title: 'User Console/Fragments/Connectivity Checks',
  component: ConnectivityChecksPanel,
  tags: ['autodocs'],
  args: {
    title: 'Connectivity Checks',
    costHint: 'Runs a small MCP handshake and the full Tavily API chain against the mock upstream.',
    costHintAria: 'Connectivity check cost hint',
    stepStatusText,
    mcpButtonLabel: 'Test MCP',
    apiButtonLabel: 'Test API',
    mcpProbe: idleProbe,
    apiProbe: idleProbe,
  },
  parameters: {
    layout: 'padded',
    controls: { disable: true },
    docs: {
      description: {
        component:
          'Standalone Token Detail connectivity-check fragment. Use this isolated gallery to compare MCP/API probe states without loading the full User Console page shell.',
      },
    },
  },
} satisfies Meta<typeof ConnectivityChecksPanel>

export default meta

type Story = StoryObj<typeof meta>

export const StateGallery: Story = {
  name: 'State Gallery',
  render: () => <ConnectivityChecksGallery />,
}
