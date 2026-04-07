import type { Meta, StoryObj } from '@storybook/react-vite'

import NotFoundFallbackPreview from './NotFoundFallbackPreview'

const meta = {
  title: 'Support/Pages/NotFoundFallback',
  component: NotFoundFallbackPreview,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'HTML 404 fallback used by unknown SPA routes. It must stay theme-consistent with the shared light/dark token system instead of falling back to a hard-coded white page background.',
      },
    },
  },
  args: {
    originalPath: '/accounts',
    returnHref: '/',
  },
  render: (args) => <NotFoundFallbackPreview {...args} />,
} satisfies Meta<typeof NotFoundFallbackPreview>

export default meta

type Story = StoryObj<typeof meta>

export const LightTheme: Story = {
  globals: {
    themeMode: 'light',
  },
  parameters: {
    docs: {
      description: {
        story: 'Light-theme 404 fallback proof for unknown HTML routes such as `/accounts`.',
      },
    },
  },
}

export const DarkTheme: Story = {
  globals: {
    themeMode: 'dark',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Dark-theme 404 fallback proof. The shell, page background, and text contrast must stay aligned with the shared dark theme tokens.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    await new Promise((resolve) => window.setTimeout(resolve, 50))

    for (const selector of ['.not-found-page-body', '.not-found-shell', '.not-found-primary']) {
      if (canvasElement.querySelector(selector) == null) {
        throw new Error(`Expected 404 fallback story to render ${selector}`)
      }
    }

    const text = canvasElement.ownerDocument.body.textContent ?? ''
    for (const expected of ['404', 'Page not found', '/accounts', 'Return to dashboard']) {
      if (!text.includes(expected)) {
        throw new Error(`Expected dark 404 fallback story to contain: ${expected}`)
      }
    }
  },
}
