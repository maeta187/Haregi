import { describe, expect, it } from 'vitest'

import {
  validateSignup,
  validateUpdateUser,
  validateChangePassword,
} from './validation.ts'

describe('会員登録の入力検証', () => {
  it('日本語・記号を許可し、表示名を trim する', () => {
    const result = validateSignup({
      name: '  晴れ ☀  ',
      email: 'user@example.com',
      password: 'password123',
      areaCode: '130000',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.name).toBe('晴れ ☀')
  })

  it.each([
    { name: '' },
    { name: '   ' },
    { name: 'あ'.repeat(21) },
    { email: 'invalid' },
    { password: 'abcdefgh' },
    { password: '12345678' },
    { password: 'ABCDEF12' },
    { areaCode: '999999' },
    { areaCode: '' },
  ])('不正な登録入力 %j を拒否する', (input) => {
    expect(
      validateSignup({
        name: 'あ',
        email: 'user@example.com',
        password: 'password123',
        areaCode: '130000',
        ...input,
      }).success,
    ).toBe(false)
  })

  it('ユーザー更新でも trim と地域の検証を行い、省略項目を補わない', () => {
    expect(validateUpdateUser({ name: ' あ ' })).toMatchObject({
      success: true,
      data: { name: 'あ' },
    })
    expect(validateUpdateUser({ areaCode: '999999' }).success).toBe(false)
    expect(validateUpdateUser({ name: ' ' }).success).toBe(false)
    expect(validateUpdateUser({ name: 'あ'.repeat(21) }).success).toBe(false)
    expect(validateUpdateUser({})).toMatchObject({ success: true, data: {} })
  })

  it('変更後のパスワードにも共通のルールを適用する', () => {
    expect(validateChangePassword('abcdefgh').success).toBe(false)
    expect(validateChangePassword('12345678').success).toBe(false)
    expect(validateChangePassword('password123').success).toBe(true)
  })

  it.each(['a1', 'a1'.repeat(11)])(
    '文字種が正しい %s の長さ検証は Better Auth に委ねる',
    (password) => {
      expect(
        validateSignup({
          name: '晴れ',
          email: 'user@example.com',
          areaCode: '130000',
          password,
        }).success,
      ).toBe(true)
      expect(validateChangePassword(password).success).toBe(true)
    },
  )
})
