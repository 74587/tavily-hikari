import { describe, expect, it, mock } from 'bun:test'

import { copyText, isCopyIntentKey, selectAllReadonlyText, shouldPrewarmSecretCopy } from './clipboard'

function createDocumentMock(execResult: boolean) {
  const textarea = {
    value: '',
    contentEditable: 'inherit',
    readOnly: true,
    style: {} as Record<string, string>,
    setAttribute: mock(() => undefined),
    focus: mock(() => undefined),
    select: mock(() => undefined),
    setSelectionRange: mock(() => undefined),
  }
  const range = {
    selectNodeContents: mock(() => undefined),
    cloneRange: mock(() => ({ restored: true })),
  }
  const selection = {
    rangeCount: 0,
    removeAllRanges: mock(() => undefined),
    addRange: mock(() => undefined),
    getRangeAt: mock(() => range),
  }

  const body = {
    appendChild: mock(() => {
      ;(textarea as { parentNode?: unknown }).parentNode = body
      return textarea
    }),
    removeChild: mock(() => {
      ;(textarea as { parentNode?: unknown }).parentNode = null
      return textarea
    }),
  }

  const execState = {
    contentEditableAtExec: null as string | null,
    readOnlyAtExec: null as boolean | null,
  }

  const doc = {
    body,
    activeElement: null,
    createElement: mock(() => textarea),
    createRange: mock(() => range),
    execCommand: mock(() => {
      execState.contentEditableAtExec = textarea.contentEditable
      execState.readOnlyAtExec = textarea.readOnly
      return execResult
    }),
    getSelection: mock(() => selection),
  }

  return { doc: doc as unknown as Document, textarea, body, range, selection, execState }
}

describe('clipboard helpers', () => {
  it('uses the Clipboard API when available', async () => {
    const writeText = mock(async () => undefined)
    const { doc } = createDocumentMock(true)

    const result = await copyText('th-a1b2-secret', {
      nav: { clipboard: { writeText } } as unknown as Navigator,
      doc,
    })

    expect(result).toEqual({ ok: true, method: 'clipboard' })
    expect(writeText).toHaveBeenCalledWith('th-a1b2-secret')
  })

  it('falls back to execCommand when Clipboard API is rejected', async () => {
    const writeText = mock(async () => {
      throw new Error('NotAllowedError')
    })
    const { doc, textarea, body } = createDocumentMock(true)

    const result = await copyText('th-a1b2-secret', {
      nav: { clipboard: { writeText } } as unknown as Navigator,
      doc,
    })

    expect(result.ok).toBe(true)
    expect(result.method).toBe('execCommand')
    expect(result.errors?.clipboard).toBeInstanceOf(Error)
    expect(textarea.select).toHaveBeenCalledTimes(1)
    expect(textarea.setSelectionRange).toHaveBeenCalledWith(0, 'th-a1b2-secret'.length)
    expect(body.appendChild).toHaveBeenCalledTimes(1)
    expect(body.removeChild).toHaveBeenCalledTimes(1)
  })

  it('can prefer execCommand before awaiting the Clipboard API', async () => {
    const writeText = mock(async () => {
      throw new Error('clipboard should not be called first')
    })
    const { doc, textarea } = createDocumentMock(true)

    const result = await copyText('th-a1b2-secret', {
      nav: { clipboard: { writeText } } as unknown as Navigator,
      doc,
      preferExecCommand: true,
    })

    expect(result).toEqual({ ok: true, method: 'execCommand' })
    expect(writeText).toHaveBeenCalledTimes(0)
    expect(textarea.select).toHaveBeenCalledTimes(1)
  })

  it('can skip execCommand when the user gesture has already been consumed', async () => {
    const writeText = mock(async () => {
      throw new Error('Blocked')
    })
    const { doc } = createDocumentMock(true)

    const result = await copyText('th-a1b2-secret', {
      nav: { clipboard: { writeText } } as unknown as Navigator,
      doc,
      allowExecCommand: false,
    })

    expect(result.ok).toBe(false)
    expect(result.method).toBeNull()
    expect(result.errors?.clipboard).toBeInstanceOf(Error)
    expect(result.errors?.execCommand).toBeUndefined()
  })

  it('reports failure when both Clipboard API and execCommand fail', async () => {
    const writeText = mock(async () => {
      throw new Error('Blocked')
    })
    const { doc } = createDocumentMock(false)

    const result = await copyText('th-a1b2-secret', {
      nav: { clipboard: { writeText } } as unknown as Navigator,
      doc,
    })

    expect(result.ok).toBe(false)
    expect(result.method).toBeNull()
    expect(result.errors?.clipboard).toBeInstanceOf(Error)
    expect(result.errors?.execCommand).toBeInstanceOf(Error)
  })

  it('uses the iOS selection hack for execCommand fallback on Apple touch browsers', async () => {
    const writeText = mock(async () => {
      throw new Error('NotAllowedError')
    })
    const { doc, textarea, range, selection, execState } = createDocumentMock(true)

    const result = await copyText('th-a1b2-secret', {
      nav: {
        clipboard: { writeText },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        platform: 'iPhone',
        maxTouchPoints: 5,
      } as unknown as Navigator,
      doc,
    })

    expect(result.ok).toBe(true)
    expect(result.method).toBe('execCommand')
    expect(range.selectNodeContents).toHaveBeenCalledWith(textarea)
    expect(selection.removeAllRanges).toHaveBeenCalledTimes(2)
    expect(selection.addRange).toHaveBeenCalledTimes(1)
    expect(textarea.setSelectionRange).toHaveBeenCalledWith(0, 'th-a1b2-secret'.length)
    expect(execState.contentEditableAtExec).toBe('true')
    expect(execState.readOnlyAtExec).toBe(false)
    expect(textarea.readOnly).toBe(true)
    expect(textarea.contentEditable).toBe('inherit')
  })

  it('cleans up the temporary textarea when iOS selection prep throws', async () => {
    const { doc, body } = createDocumentMock(true)
    ;(doc.createRange as ReturnType<typeof mock>).mockImplementationOnce(() => {
      throw new Error('createRange failed')
    })

    const result = await copyText('th-a1b2-secret', {
      nav: {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        platform: 'iPhone',
        maxTouchPoints: 5,
      } as unknown as Navigator,
      doc,
      preferExecCommand: true,
    })

    expect(result.ok).toBe(false)
    expect(result.errors?.execCommand).toBeInstanceOf(Error)
    expect(body.appendChild).toHaveBeenCalledTimes(1)
    expect(body.removeChild).toHaveBeenCalledTimes(1)
  })

  it('prewarms secret copy only when the async clipboard path is likely unreliable', () => {
    const modernNavigator = {
      clipboard: { writeText: () => Promise.resolve() },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)',
      platform: 'MacIntel',
      maxTouchPoints: 0,
    } as unknown as Navigator

    expect(shouldPrewarmSecretCopy(modernNavigator, true)).toBe(false)
    expect(shouldPrewarmSecretCopy({ userAgent: 'Mozilla/5.0', platform: 'Linux x86_64' } as Navigator, true)).toBe(true)
    expect(shouldPrewarmSecretCopy(modernNavigator, false)).toBe(true)
    expect(shouldPrewarmSecretCopy({
      clipboard: { writeText: () => Promise.resolve() },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      platform: 'iPhone',
      maxTouchPoints: 5,
    } as unknown as Navigator, true)).toBe(true)
  })

  it('only warms copy intents on activation keys', () => {
    expect(isCopyIntentKey('Enter')).toBe(true)
    expect(isCopyIntentKey(' ')).toBe(true)
    expect(isCopyIntentKey('Spacebar')).toBe(true)
    expect(isCopyIntentKey('Tab')).toBe(false)
    expect(isCopyIntentKey('ArrowDown')).toBe(false)
  })

  it('selects the full readonly value on focus', () => {
    const target = {
      value: 'https://example.com/#token',
      focus: mock(() => undefined),
      select: mock(() => undefined),
      setSelectionRange: mock(() => undefined),
    }

    selectAllReadonlyText(target)

    expect(target.focus).toHaveBeenCalledTimes(1)
    expect(target.select).toHaveBeenCalledTimes(1)
    expect(target.setSelectionRange).toHaveBeenCalledWith(0, target.value.length)
  })
})
