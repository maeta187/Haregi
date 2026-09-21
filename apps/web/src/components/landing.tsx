import { Link } from '@tanstack/react-router'
import { CloudSunIcon, HistoryIcon, ShirtIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * ランディング。仮テキストは置かず、何ができるアプリかを具体的に書く
 * (specification.md §2.4)。
 */
export function Landing() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-16">
      <section className="mx-auto max-w-2xl text-center">
        <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Haregi(ハレギ)
        </h1>
        <p className="text-muted-foreground mt-4 text-lg text-pretty">
          週間の天気予報(最高・最低気温)を見ながら、日ごとの服装コーディネートを記録・管理する
          Web アプリです。
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/signup"
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-5 py-2.5 text-sm font-medium"
          >
            はじめる(無料)
          </Link>
          <Link
            to="/login"
            className="border-input hover:bg-accent rounded-md border px-5 py-2.5 text-sm font-medium"
          >
            ログイン
          </Link>
        </div>
      </section>

      <section className="mt-16 grid gap-6 sm:grid-cols-3">
        <Feature icon={<CloudSunIcon className="size-5" />} title="気温を見る">
          お住まいの地域の<strong>週間の最高・最低気温</strong>
          を、気象庁の予報から表示します。
        </Feature>
        <Feature icon={<ShirtIcon className="size-5" />} title="コーデを書く">
          日付ごとに<strong>アウター・トップス・ボトムス</strong>
          を記録します。1週間分をまとめて書けます。
        </Feature>
        <Feature icon={<HistoryIcon className="size-5" />} title="あとで見返す">
          過去のコーデを、
          <strong>記録した気温とあわせて振り返れます</strong>。
          「何度の日に何を着たか」が残ります。
        </Feature>
      </section>
    </main>
  )
}

function Feature({
  icon,
  title,
  children,
}: {
  icon: ReactNode
  title: string
  children: ReactNode
}) {
  return (
    <article className="border-border/60 rounded-lg border p-5">
      <div className="text-muted-foreground mb-3 flex items-center gap-2">
        {icon}
        <h2 className="text-foreground text-sm font-medium">{title}</h2>
      </div>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {children}
      </p>
    </article>
  )
}
