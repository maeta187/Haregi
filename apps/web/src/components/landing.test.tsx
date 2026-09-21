import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Landing } from './landing.tsx'
import { renderWithRouter } from '@/test/render-with-router.tsx'

describe('Landing', () => {
  it('アプリ名を見出しレベル1で表示する', async () => {
    await renderWithRouter(<Landing />)

    expect(
      screen.getByRole('heading', { level: 1, name: /Haregi/ }),
    ).toBeInTheDocument()
  })

  it('アプリが何をするものかの説明を表示する', async () => {
    await renderWithRouter(<Landing />)

    expect(
      screen.getByText(/日ごとの服装コーディネートを記録・管理する/),
    ).toBeVisible()
  })

  it('会員登録とログインへの導線を持つ', async () => {
    await renderWithRouter(<Landing />)

    expect(screen.getByRole('link', { name: 'はじめる(無料)' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'ログイン' })).toBeVisible()
  })

  it('何ができるかを具体的に説明する(仮テキストを置かない)', async () => {
    await renderWithRouter(<Landing />)

    expect(screen.getByText(/週間の最高・最低気温/)).toBeVisible()
    expect(screen.getByText(/アウター・トップス・ボトムス/)).toBeVisible()
    expect(screen.getByText(/記録した気温とあわせて振り返/)).toBeVisible()
  })
})
