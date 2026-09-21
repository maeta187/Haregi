import type { AppType } from '@haregi/api'
import { hc } from 'hono/client'

/**
 * Hono RPC クライアント。api の `AppType` から型を得るため、
 * エンドポイントの追加・変更はコンパイル時に web へ伝播する。
 *
 * fetch を直接書かず、呼び出しは `features/*\/api/` からのみ行う
 * (ui-web.md「ディレクトリ構成・依存方向」)。
 */
export const apiClient = hc<AppType>('/')
