/* Haregi 画面モック: ライト / ダークの切替
   モックで唯一の JavaScript。実装側の仕様ではなく、モック閲覧の利便のためのもの。
   - 既定は OS の設定に追随する(html に data-theme を付けない)
   - ボタンを押すと data-theme='light' | 'dark' を明示し、localStorage に保存する
   - file:// で開いた場合 localStorage が使えないことがあるため、その場合はページ内だけで切り替わる */
(() => {
  const KEY = 'haregi-mock-theme'
  const root = document.documentElement

  const read = () => {
    try {
      return localStorage.getItem(KEY)
    } catch {
      return null
    }
  }

  const write = (value) => {
    try {
      localStorage.setItem(KEY, value)
    } catch {
      /* file:// などで保存できない場合は無視する */
    }
  }

  const saved = read()
  if (saved === 'light' || saved === 'dark') root.dataset.theme = saved

  const prefersDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-theme-toggle]')
    if (!trigger) return

    const current = root.dataset.theme || (prefersDark() ? 'dark' : 'light')
    const next = current === 'dark' ? 'light' : 'dark'
    root.dataset.theme = next
    write(next)
  })
})()
