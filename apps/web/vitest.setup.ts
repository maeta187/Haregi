import '@testing-library/jest-dom/vitest'

// jsdom は scrollTo を実装していない。TanStack Router の scrollRestoration が
// 呼ぶため、テスト出力のノイズを抑える目的で no-op を置く。
if (typeof window !== 'undefined') {
  window.scrollTo = () => {}
}
