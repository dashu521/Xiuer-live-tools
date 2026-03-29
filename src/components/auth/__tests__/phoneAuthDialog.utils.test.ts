import { describe, expect, it } from 'vitest'
import { normalizeCodeInput, normalizePhoneInput } from '../PhoneAuthDialog'

describe('PhoneAuthDialog input normalization', () => {
  it('normalizes phone input to 11 digits', () => {
    expect(normalizePhoneInput(' 177-0125 9200 ')).toBe('17701259200')
  })

  it('keeps only 6 digits for sms code', () => {
    expect(normalizeCodeInput(' 84 88a83 ')).toBe('848883')
  })
})
