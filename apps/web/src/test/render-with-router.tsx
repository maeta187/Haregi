import { render } from '@testing-library/react'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'

/** 実ルートと同じパスを持つスタブ(`Link` の解決に必要なだけの最小構成)。 */
const STUB_PATHS = ['/login', '/signup', '/forecast'] as const

/**
 * `Link` を含むコンポーネントをルーター文脈つきで描画する。
 * 画面全体ではなく対象コンポーネントだけを描画したいため、実ルートツリーではなく
 * パスだけを揃えたスタブを使う。
 */
export async function renderWithRouter(ui: ReactNode) {
  const rootRoute = createRootRoute({ component: () => <>{ui}</> })
  rootRoute.addChildren(
    STUB_PATHS.map((path) =>
      createRoute({
        getParentRoute: () => rootRoute,
        path,
        component: () => null,
      }),
    ),
  )

  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })

  // ルーターは初回マッチを非同期に解決するため、描画前に待つ
  await router.load()

  return render(<RouterProvider router={router as never} />)
}
