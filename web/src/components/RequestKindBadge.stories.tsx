import type { Meta, StoryObj } from '@storybook/react-vite'

import RequestKindBadge from './RequestKindBadge'

const requestKindExamples = [
  { requestKindKey: 'api:search', requestKindLabel: 'API | search' },
  { requestKindKey: 'api:extract', requestKindLabel: 'API | extract' },
  { requestKindKey: 'api:crawl', requestKindLabel: 'API | crawl' },
  { requestKindKey: 'api:map', requestKindLabel: 'API | map' },
  { requestKindKey: 'api:research', requestKindLabel: 'API | research' },
  { requestKindKey: 'api:research-result', requestKindLabel: 'API | research result' },
  { requestKindKey: 'api:usage', requestKindLabel: 'API | usage' },
  { requestKindKey: 'api:raw:/api/internal/report', requestKindLabel: 'API | /api/internal/report' },
  { requestKindKey: 'mcp:search', requestKindLabel: 'MCP | search' },
  { requestKindKey: 'mcp:batch', requestKindLabel: 'MCP | batch' },
  { requestKindKey: 'mcp:tool:Acme Lookup', requestKindLabel: 'MCP | Acme Lookup' },
  { requestKindKey: 'mcp:initialize', requestKindLabel: 'MCP | initialize' },
  { requestKindKey: 'mcp:resources/subscribe', requestKindLabel: 'MCP | resources/subscribe' },
  { requestKindKey: 'mcp:raw:/mcp/sse', requestKindLabel: 'MCP | /mcp/sse' },
] as const

function ThemePanel({
  title,
  dark = false,
}: {
  title: string
  dark?: boolean
}): JSX.Element {
  return (
    <div className={dark ? 'dark' : undefined}>
      <div
        style={{
          padding: 20,
          borderRadius: 20,
          border: '1px solid hsl(var(--border) / 0.82)',
          background: 'linear-gradient(180deg, hsl(var(--card) / 0.98), hsl(var(--card) / 0.92))',
          color: 'hsl(var(--foreground))',
          boxShadow: '0 18px 40px -28px hsl(var(--foreground) / 0.18)',
        }}
      >
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'hsl(var(--muted-foreground))' }}>
            {title}
          </div>
          <div style={{ fontSize: '0.92rem', color: 'hsl(var(--muted-foreground))' }}>
            Theme-aware color catalog for common API and MCP request kinds.
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          }}
        >
          {requestKindExamples.map((example) => (
            <div
              key={example.requestKindKey}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '10px 12px',
                borderRadius: 16,
                border: '1px solid hsl(var(--border) / 0.72)',
                background: 'hsl(var(--background) / 0.58)',
              }}
            >
              <code style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>{example.requestKindKey}</code>
              <RequestKindBadge {...example} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const meta = {
  title: 'Components/RequestKindBadge',
  component: RequestKindBadge,
  tags: ['autodocs'],
  args: {
    requestKindKey: 'api:search',
    requestKindLabel: 'API | search',
    size: 'md',
  },
  argTypes: {
    size: {
      control: 'radio',
      options: ['sm', 'md'],
    },
  },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Theme-aware request type pill used by admin token logs. It maps stable request-kind keys to distinct API/MCP palettes, while unknown keys fall back to protocol-aware neutral tones.',
      },
    },
  },
  render: (args) => (
    <div style={{ padding: 24, borderRadius: 20, border: '1px solid hsl(var(--border) / 0.82)', background: 'hsl(var(--card) / 0.88)' }}>
      <RequestKindBadge {...args} />
    </div>
  ),
} satisfies Meta<typeof RequestKindBadge>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Compact: Story = {
  args: {
    requestKindKey: 'mcp:batch',
    requestKindLabel: 'MCP | batch',
    size: 'sm',
  },
}

export const ThemeCatalog: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 20 }}>
      <ThemePanel title="Light surface" />
      <ThemePanel title="Dark surface" dark />
    </div>
  ),
}
