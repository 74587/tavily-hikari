import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'

import BrandLockup from './BrandLockup'

const meta = {
  title: 'Brand/Lockup',
  component: BrandLockup,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  args: {
    title: 'Tavily Hikari',
  },
} satisfies Meta<typeof BrandLockup>

export default meta

type Story = StoryObj<typeof meta>

function responsiveCanvas(width: number): Decorator {
  return (Story) => (
    <div
      style={{
        display: 'grid',
        position: 'fixed',
        inset: 0,
        placeItems: 'center',
        background: '#d8e0eb',
      }}
    >
      <div
        style={{
          display: 'grid',
          width: 750,
          height: 420,
          placeItems: 'center',
          border: '1px solid #cbd5e1',
          background: '#ffffff',
        }}
      >
        <div style={{ width }}><Story /></div>
      </div>
    </div>
  )
}

export const Full: Story = {
  args: {
    variant: 'full',
  },
}

export const Compact: Story = {
  args: {
    variant: 'compact',
  },
}

export const ResponsiveDesktop: Story = {
  args: {
    variant: 'responsive',
  },
  decorators: [responsiveCanvas(360)],
  parameters: {
    viewport: { defaultViewport: 'desktop1440' },
  },
  play: async ({ canvasElement }) => {
    await new Promise((resolve) => window.setTimeout(resolve, 50))
    const full = canvasElement.querySelector<HTMLElement>('.brand-lockup-image-full.brand-lockup-image-light')
    if (full == null || window.getComputedStyle(full).display === 'none') {
      throw new Error('Expected the full lockup at 360px.')
    }
  },
}

export const ResponsiveMinimum: Story = {
  args: {
    variant: 'responsive',
  },
  decorators: [responsiveCanvas(260)],
  play: async ({ canvasElement }) => {
    await new Promise((resolve) => window.setTimeout(resolve, 50))
    const full = canvasElement.querySelector<HTMLElement>('.brand-lockup-image-full.brand-lockup-image-light')
    if (full == null || window.getComputedStyle(full).display === 'none') {
      throw new Error('Expected the full lockup at the 260px minimum.')
    }
  },
}

export const ResponsiveCompact: Story = {
  args: {
    variant: 'responsive',
  },
  decorators: [responsiveCanvas(220)],
  play: async ({ canvasElement }) => {
    await new Promise((resolve) => window.setTimeout(resolve, 50))
    const lockup = canvasElement.querySelector<HTMLElement>('.brand-lockup')
    const compact = canvasElement.querySelector<HTMLElement>('.brand-lockup-image-compact.brand-lockup-image-light')
    if (lockup == null || compact == null || window.getComputedStyle(compact).display === 'none') {
      throw new Error('Expected the compact lockup below 260px.')
    }
    const lockupBounds = lockup.getBoundingClientRect()
    const compactBounds = compact.getBoundingClientRect()
    if (Math.abs((compactBounds.left + compactBounds.width / 2) - (lockupBounds.left + lockupBounds.width / 2)) > 1) {
      throw new Error('Expected the compact lockup to remain centered in its responsive container.')
    }
  },
}
