import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { LoginForm } from './login-form.tsx'

describe('LoginForm', () => {
  it('未入力のまま送信すると日本語のエラーを表示し、送信しない', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<LoginForm onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: 'ログイン' }))

    expect(
      await screen.findByText('メールアドレスの形式が正しくありません'),
    ).toBeVisible()
    expect(screen.getByText('パスワードを入力してください')).toBeVisible()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('有効な入力を送信する', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<LoginForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('メールアドレス'), 'user@example.com')
    await user.type(screen.getByLabelText('パスワード'), 'password1')
    await user.click(screen.getByRole('button', { name: 'ログイン' }))

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password1',
    })
  })

  it('認証に失敗したときのエラーメッセージを表示する', () => {
    render(
      <LoginForm
        onSubmit={vi.fn()}
        errorMessage="メールアドレスまたはパスワードが正しくありません"
      />,
    )

    expect(
      screen.getByText('メールアドレスまたはパスワードが正しくありません'),
    ).toBeVisible()
  })
})
