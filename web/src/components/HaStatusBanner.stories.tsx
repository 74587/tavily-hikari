import type { Meta, StoryObj } from '@storybook/react'
import HaStatusBanner from './HaStatusBanner'
import type { HaStatus } from '../api'

const baseStatus: HaStatus = {
  mode: 'active_standby',
  nodeId: 'node-a',
  nodePublicOrigin: '203.0.113.10:58087',
  role: 'provisional_master',
  degraded: true,
  allowsBasicBusiness: true,
  allowsFullWrites: false,
  edgeoneDomain: 'api.example.com',
  edgeoneOrigin: '203.0.113.10:58087',
  edgeoneExpectedOrigin: '203.0.113.9:58087',
  edgeoneApiConfigured: true,
  lastEdgeoneCheckAt: 1_700_000_000,
  lastSyncAt: 1_700_000_002,
  syncLagSeconds: 8,
  recoveryStatus: null,
  message: 'promoted by EdgeOne origin switch; finalize required',
}

const meta = {
  title: 'Components/HaStatusBanner',
  component: HaStatusBanner,
  args: {
    status: baseStatus,
    audience: 'admin',
  },
} satisfies Meta<typeof HaStatusBanner>

export default meta
type Story = StoryObj<typeof meta>

export const ProvisionalAdmin: Story = {}

export const StandbyAdmin: Story = {
  args: {
    status: {
      ...baseStatus,
      role: 'standby',
      allowsBasicBusiness: false,
      edgeoneOrigin: '203.0.113.9:58087',
    },
  },
}

export const UserDegraded: Story = {
  args: {
    audience: 'user',
  },
}
