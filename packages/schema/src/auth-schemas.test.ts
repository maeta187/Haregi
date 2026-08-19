import { describe, expect, it } from 'vitest'

import { loginSchema, signupSchema } from '@haregi/schema'

const validSignup = {
  name: 'ハレギ太郎',
  email: 'user@example.com',
  password: 'password1',
  areaCode: '130000',
}

describe('signupSchema', () => {
  it('名前をtrimして日本語を含む有効な入力を受理する', () => {
    const result = signupSchema.safeParse({
      ...validSignup,
      name: '  ハレギ太郎  ',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('ハレギ太郎')
    }
  })

  it.each(['名', '名'.repeat(20)])('trim後%sの名前を受理する', (name) => {
    expect(signupSchema.safeParse({ ...validSignup, name }).success).toBe(true)
  })

  it.each(['   ', '名'.repeat(21)])(
    'trim後の長さが範囲外の名前を拒否する',
    (name) => {
      expect(signupSchema.safeParse({ ...validSignup, name }).success).toBe(
        false,
      )
    },
  )

  it('メール形式でない入力を拒否する', () => {
    expect(
      signupSchema.safeParse({ ...validSignup, email: 'not-an-email' }).success,
    ).toBe(false)
  })

  it.each(['abcdefg1', 'abcdefghij1234567890'])(
    '境界長の有効なパスワード %s を受理する',
    (password) => {
      expect(signupSchema.safeParse({ ...validSignup, password }).success).toBe(
        true,
      )
    },
  )

  it.each([
    ['7文字', 'abcdef1'],
    ['21文字', 'abcdefghijk1234567890'],
    ['小文字英字なし', 'PASSWORD1'],
    ['数字なし', 'abcdefgh'],
  ])('%sのパスワードを拒否する', (_case, password) => {
    expect(signupSchema.safeParse({ ...validSignup, password }).success).toBe(
      false,
    )
  })

  it('地域マスタに存在する地域だけを受理する', () => {
    expect(
      signupSchema.safeParse({ ...validSignup, areaCode: '460040' }).success,
    ).toBe(true)
    expect(
      signupSchema.safeParse({ ...validSignup, areaCode: '999999' }).success,
    ).toBe(false)
  })

  it('不正な入力に日本語の利用者向けメッセージを返す', () => {
    const result = signupSchema.safeParse({ ...validSignup, name: ' ' })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          /[ぁ-んァ-ヶ一-龠]/.test(issue.message),
        ),
      ).toBe(true)
    }
  })
})

describe('loginSchema', () => {
  it('メールアドレスとパスワードを受理する', () => {
    expect(
      loginSchema.safeParse({
        email: 'user@example.com',
        password: 'password1',
      }).success,
    ).toBe(true)
  })

  it('メール形式でない入力を拒否する', () => {
    expect(
      loginSchema.safeParse({
        email: 'not-an-email',
        password: 'password1',
      }).success,
    ).toBe(false)
  })

  it('空のパスワードを拒否する', () => {
    expect(
      loginSchema.safeParse({
        email: 'user@example.com',
        password: '',
      }).success,
    ).toBe(false)
  })
})
