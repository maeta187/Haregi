import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AppNav } from './app-nav.tsx'
import { renderWithRouter } from '@/test/render-with-router.tsx'

const user = {
  id: 'user-1',
  name: 'ハレギ太郎',
  email: 'user@example.com',
  areaCode: '130000',
}

const desktopNav = () =>
  within(screen.getByRole('navigation', { name: 'メインナビゲーション' }))

const mobileNav = () =>
  within(screen.getByRole('navigation', { name: 'モバイルナビゲーション' }))

async function openDrawer() {
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'メニューを開く' }))

  expect(
    screen.getByRole('navigation', { name: 'モバイルナビゲーション' }),
  ).toBeVisible()
}

async function expectDrawerClosed() {
  await waitFor(() => {
    expect(
      screen.queryByRole('navigation', { name: 'モバイルナビゲーション' }),
    ).not.toBeInTheDocument()
  })
}

describe('AppNav', () => {
  it('未ログイン時はログインと新規登録を出す', async () => {
    await renderWithRouter(<AppNav user={null} onLogout={vi.fn()} />)

    expect(desktopNav().getByRole('link', { name: 'ログイン' })).toBeVisible()
    expect(desktopNav().getByRole('link', { name: '新規登録' })).toBeVisible()
    expect(
      desktopNav().queryByRole('button', { name: 'ログアウト' }),
    ).not.toBeInTheDocument()
  })

  it('ログイン時はユーザー名とログアウトを出し、ログイン導線を隠す', async () => {
    await renderWithRouter(<AppNav user={user} onLogout={vi.fn()} />)

    expect(desktopNav().getByText('ハレギ太郎')).toBeVisible()
    expect(
      desktopNav().getByRole('button', { name: 'ログアウト' }),
    ).toBeVisible()
    expect(
      desktopNav().queryByRole('link', { name: 'ログイン' }),
    ).not.toBeInTheDocument()
  })

  it('ログアウトを押すとコールバックを呼ぶ', async () => {
    const onLogout = vi.fn()
    await renderWithRouter(<AppNav user={user} onLogout={onLogout} />)

    await userEvent
      .setup()
      .click(desktopNav().getByRole('button', { name: 'ログアウト' }))

    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  it('モバイル用にドロワーを開くボタンを持つ', async () => {
    await renderWithRouter(<AppNav user={null} onLogout={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'メニューを開く' })).toBeVisible()
  })

  it.each([['ログイン'], ['新規登録']])(
    '未ログイン時、ドロワーの %s を押すとドロワーが閉じる(遷移先を覆わない)',
    async (name) => {
      await renderWithRouter(<AppNav user={null} onLogout={vi.fn()} />)

      await openDrawer()
      await userEvent.setup().click(mobileNav().getByRole('link', { name }))

      await expectDrawerClosed()
    },
  )

  it('ログイン時、ドロワーの予報リンクを押すとドロワーが閉じる', async () => {
    await renderWithRouter(<AppNav user={user} onLogout={vi.fn()} />)

    await openDrawer()
    await userEvent
      .setup()
      .click(mobileNav().getByRole('link', { name: '予報とコーデ' }))

    await expectDrawerClosed()
  })

  it('ドロワーのログアウトはコールバックを呼び、ドロワーも閉じる', async () => {
    const onLogout = vi.fn()
    await renderWithRouter(<AppNav user={user} onLogout={onLogout} />)

    await openDrawer()
    await userEvent
      .setup()
      .click(mobileNav().getByRole('button', { name: 'ログアウト' }))

    expect(onLogout).toHaveBeenCalledTimes(1)
    await expectDrawerClosed()
  })
})
