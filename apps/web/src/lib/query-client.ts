import { QueryClient } from '@tanstack/react-query'

/**
 * TanStack Query のクライアント。SSR とテストでインスタンスを共有しないよう、
 * シングルトンではなくファクトリとして公開する。
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // 予報は api 側でもキャッシュするため、画面側の再取得は控えめにする
        staleTime: 60_000,
        retry: 1,
      },
    },
  })
}
