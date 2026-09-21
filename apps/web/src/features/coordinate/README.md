# features/coordinate

機能優先スライス(決定事項 #28)。層の責務は以下のとおり。

- `components/`: 表示のみ(props in / callback out)。副作用を持たない
- `hooks/`: ユースケース。TanStack Query の `useQuery` / `useMutation` を包む
- `api/`: 外部 I/O。`hc<AppType>` / `authClient` の呼び出しをここに閉じる
- `model/`: 表示用の純粋変換のみ(任意)。ビジネスルールは `@haregi/schema` に置く

依存方向は `routes → features → (components/ui, lib, @haregi/schema)` の一方向。
