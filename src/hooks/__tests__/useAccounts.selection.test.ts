import { describe, expect, it } from 'vitest'
import { normalizeAccountSelection } from '@/hooks/useAccounts'

describe('normalizeAccountSelection', () => {
  const accounts = [
    { id: 'acc-1', name: '账号1' },
    { id: 'acc-2', name: '账号2' },
    { id: 'acc-3', name: '账号3' },
  ]

  it('keeps valid current id and ignores legacy default id', () => {
    expect(normalizeAccountSelection(accounts, 'acc-2', 'acc-3')).toEqual({
      currentAccountId: 'acc-2',
      defaultAccountId: null,
    })
  })

  it('falls back current to first account when current is invalid', () => {
    expect(normalizeAccountSelection(accounts, 'missing', 'acc-3')).toEqual({
      currentAccountId: 'acc-1',
      defaultAccountId: null,
    })
  })

  it('falls back to first account when current is empty', () => {
    expect(normalizeAccountSelection(accounts, '', 'missing')).toEqual({
      currentAccountId: 'acc-1',
      defaultAccountId: null,
    })
  })

  it('returns empty selection when account list is empty', () => {
    expect(normalizeAccountSelection([], 'acc-1', 'acc-1')).toEqual({
      currentAccountId: '',
      defaultAccountId: null,
    })
  })
})
