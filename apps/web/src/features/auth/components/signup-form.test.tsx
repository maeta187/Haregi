import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { SignupForm } from './signup-form.tsx'

const fill = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText('ユーザー名'), 'ハレギ太郎')
  await user.type(screen.getByLabelText('メールアドレス'), 'user@example.com')
  await user.type(screen.getByLabelText('パスワード'), 'password1')
  await user.type(screen.getByLabelText('パスワード(確認)'), 'password1')
}

describe('SignupForm', () => {
  it('未入力のまま送信すると日本語のエラーを表示し、送信しない', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<SignupForm onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: '登録する' }))

    expect(
      await screen.findByText('ユーザー名を入力してください'),
    ).toBeVisible()
    expect(
      screen.getByText('メールアドレスの形式が正しくありません'),
    ).toBeVisible()
    expect(screen.getByText('登録地域を選択してください')).toBeVisible()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('パスワードが文字種の条件を満たさない場合にエラーを表示する', async () => {
    const user = userEvent.setup()
    render(<SignupForm onSubmit={vi.fn()} />)

    await user.type(screen.getByLabelText('パスワード'), 'PASSWORD1')
    await user.click(screen.getByRole('button', { name: '登録する' }))

    expect(
      await screen.findByText('パスワードには小文字の英字を含めてください'),
    ).toBeVisible()
  })

  it('パスワードと確認が一致しない場合にエラーを表示する', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<SignupForm onSubmit={onSubmit} />)

    await fill(user)
    await user.clear(screen.getByLabelText('パスワード(確認)'))
    await user.type(screen.getByLabelText('パスワード(確認)'), 'password2')
    await user.click(screen.getByRole('button', { name: '登録する' }))

    expect(await screen.findByText('パスワードが一致しません')).toBeVisible()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('有効な入力を送信すると、確認用パスワードを除いた値を渡す', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<SignupForm onSubmit={onSubmit} />)

    await fill(user)
    await user.selectOptions(screen.getByLabelText('登録地域'), '130000')
    await user.click(screen.getByRole('button', { name: '登録する' }))

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'ハレギ太郎',
      email: 'user@example.com',
      password: 'password1',
      areaCode: '130000',
    })
  })

  it('サーバーから返ったエラーメッセージを表示する', () => {
    render(
      <SignupForm
        onSubmit={vi.fn()}
        errorMessage="このメールアドレスは既に登録されています"
      />,
    )

    expect(
      screen.getByText('このメールアドレスは既に登録されています'),
    ).toBeVisible()
  })

  it('送信中は送信ボタンを押せない', () => {
    render(<SignupForm onSubmit={vi.fn()} isSubmitting />)

    expect(screen.getByRole('button', { name: '登録する' })).toBeDisabled()
  })
})
