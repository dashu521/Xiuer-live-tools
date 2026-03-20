import { describe, expect, it } from 'vitest'
import { normalizeAccountSelection } from '@/hooks/useAccounts'

describe('normalizeAccountSelection', () => {
  const accounts = [
    { id: 'acc-1', name: '账号1' },
    { id: 'acc-2', name: '账号2' },
    { id: 'acc-3', name: '账号3' },
  ]

  it('keeps valid current and default ids', () => {
    expect(normalizeAccountSelection(accounts, 'acc-2', 'acc-3')).toEqual({
      currentAccountId: 'acc-2',
      defaultAccountId: 'acc-3',
    })
  })

  it('falls back current to default when current is invalid', () => {
    expect(normalizeAccountSelection(accounts, 'missing', 'acc-3')).toEqual({
      currentAccountId: 'acc-3',
      defaultAccountId: 'acc-3',
    })
  })

  it('falls back both to first account when default is invalid', () => {
    expect(normalizeAccountSelection(accounts, '', 'missing')).toEqual({
      currentAccountId: 'acc-1',
      defaultAccountId: 'acc-1',
    })
  })

  it('returns empty selection when account list is empty', () => {
    expect(normalizeAccountSelection([], 'acc-1', 'acc-1')).toEqual({
      currentAccountId: '',
      defaultAccountId: null,
    })
  })
})
