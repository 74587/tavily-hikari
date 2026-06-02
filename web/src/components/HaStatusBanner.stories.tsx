import type { Meta, StoryObj } from '@storybook/react-vite'

import type { HaStatus } from '../api'
import HaStatusBanner from './HaStatusBanner'

const baseStatus: HaStatus = {
  mode: 'active_standby',
  nodeId: 'node-b',
  nodePublicOrigin: '203.0.113.10:58087',
  role: 'standby',
  degraded: true,
  allowsBasicBusiness: false,
  allowsFullWrites: false,
  edgeoneDomain: 'api.example.com',
  edgeoneOrigin: '203.0.113.9:58087',
  edgeoneExpectedOrigin: '203.0.113.9:58087',
  edgeoneApiConfigured: true,
  lastEdgeoneCheckAt: 1_700_000_000,
  lastSyncAt: 1_700_000_002,
  syncLagSeconds: 8,
  recoveryStatus: null,
  message: 'standby is synchronized and ready for manual promotion',
}

const provisionalStatus: HaStatus = {
  ...baseStatus,
  role: 'provisional_master',
  allowsBasicBusiness: true,
  edgeoneOrigin: '203.0.113.10:58087',
  message: 'promoted by EdgeOne origin switch; finalize required',
}

const fullMasterStatus: HaStatus = {
  ...provisionalStatus,
  role: 'full_master',
  degraded: false,
  allowsFullWrites: true,
  edgeoneExpectedOrigin: null,
  message: 'node is serving as active master',
}

const recoveryStatus: HaStatus = {
  ...baseStatus,
  nodeId: 'node-a',
  nodePublicOrigin: '203.0.113.9:58087',
  role: 'recovery',
  edgeoneOrigin: '203.0.113.10:58087',
  edgeoneExpectedOrigin: '203.0.113.9:58087',
  recoveryStatus: 'importing old-master-batch-1',
  message: 'EdgeOne origin moved to 203.0.113.10:58087; recovery import required',
}

function StoryFrame({ children }: { children: JSX.Element }): JSX.Element {
  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gap: 18 }}>
      {children}
    </div>
  )
}

function StateGallery(): JSX.Element {
  return (
    <StoryFrame>
      <>
        <HaStatusBanner
          status={baseStatus}
          audience="admin"
          onPromote={() => undefined}
        />
        <HaStatusBanner
          status={provisionalStatus}
          audience="admin"
          onFinalize={() => undefined}
        />
        <HaStatusBanner status={fullMasterStatus} audience="admin" />
        <HaStatusBanner status={recoveryStatus} audience="admin" />
      </>
    </StoryFrame>
  )
}

const meta = {
  title: 'Components/HaStatusBanner',
  component: HaStatusBanner,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'HA admin management panel with service-node rows, EdgeOne origin state, and the local promote/finalize entry point. The user audience still receives only the degraded-service notice.',
      },
    },
  },
  args: {
    status: baseStatus,
    audience: 'admin',
    onPromote: () => undefined,
  },
  render: (args) => (
    <StoryFrame>
      <HaStatusBanner {...args} />
    </StoryFrame>
  ),
} satisfies Meta<typeof HaStatusBanner>

export default meta
type Story = StoryObj<typeof meta>

export const NodeListGallery: Story = {
  render: () => <StateGallery />,
  parameters: {
    docs: {
      description: {
        story: 'Curated admin states covering standby promotion, provisional finalize, full master, and recovery rows.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const text = canvasElement.textContent ?? ''
    for (const expected of ['Node inventory', 'Promote to master', 'Finalize master', 'Use that node admin']) {
      if (!text.includes(expected)) {
        throw new Error(`Expected HA node list gallery to contain: ${expected}`)
      }
    }
  },
}

export const StandbyAdmin: Story = {
  play: async ({ canvasElement }) => {
    const text = canvasElement.textContent ?? ''
    for (const expected of ['HA service nodes', 'node-b', 'configured-peer', 'Promote to master']) {
      if (!text.includes(expected)) {
        throw new Error(`Expected standby admin story to contain: ${expected}`)
      }
    }
  },
}

export const ProvisionalAdmin: Story = {
  args: {
    status: provisionalStatus,
    onPromote: undefined,
    onFinalize: () => undefined,
  },
}

export const FullMasterAdmin: Story = {
  args: {
    status: fullMasterStatus,
    onPromote: undefined,
  },
}

export const RecoveryAdmin: Story = {
  args: {
    status: recoveryStatus,
    onPromote: undefined,
  },
}

export const CompactAdminAttention: Story = {
  args: {
    adminVariant: 'compact',
    compactHref: '/admin/system-settings/ha',
    compactTitle: 'High availability needs attention',
    compactDescription: 'This node is in failover, recovery, or write-limited state. Open HA settings for details.',
    compactActionLabel: 'View HA settings',
  },
  play: async ({ canvasElement }) => {
    const text = canvasElement.textContent ?? ''
    for (const expected of ['High availability needs attention', 'View HA settings']) {
      if (!text.includes(expected)) {
        throw new Error(`Expected compact HA alert to contain: ${expected}`)
      }
    }
    if (text.includes('Node inventory') || text.includes('Promote to master')) {
      throw new Error('Expected compact HA alert to omit node inventory and operations.')
    }
  },
}

export const UserDegraded: Story = {
  args: {
    audience: 'user',
    status: provisionalStatus,
    onPromote: undefined,
  },
}
