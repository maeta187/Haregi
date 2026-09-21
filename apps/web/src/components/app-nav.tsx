import { Link } from '@tanstack/react-router'
import { MenuIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

/**
 * ヘッダーのナビゲーション。ログイン状態は props で受け取る純粋コンポーネント
 * とし、セッション取得は `routes/__root.tsx` 側が担う(ui-web.md)。
 */
export type NavUser = {
  name: string
}

type AppNavProps = {
  user: NavUser | null
  onLogout: () => void
}

export function AppNav({ user, onLogout }: AppNavProps) {
  return (
    <header className="border-border/60 border-b">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
        <Link to="/" className="font-heading text-lg font-semibold">
          Haregi
        </Link>

        <nav
          aria-label="メインナビゲーション"
          className="hidden items-center gap-2 md:flex"
        >
          <NavLinks user={user} onLogout={onLogout} />
        </nav>

        <Sheet>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" aria-label="メニューを開く">
              <MenuIcon />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-64">
            <SheetHeader>
              <SheetTitle>メニュー</SheetTitle>
            </SheetHeader>
            <nav
              aria-label="モバイルナビゲーション"
              className="flex flex-col items-stretch gap-2 px-4"
            >
              {/*
                ドロワーは開いたままだと遷移先を覆って操作できなくなるため、
                いずれの操作でも閉じる(closeOnSelect)
              */}
              <NavLinks user={user} onLogout={onLogout} closeOnSelect />
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}

type NavLinksProps = AppNavProps & {
  /** モバイルのドロワー内で使う場合に、各操作でドロワーを閉じる。 */
  closeOnSelect?: boolean
}

function NavLinks({ user, onLogout, closeOnSelect = false }: NavLinksProps) {
  if (!user) {
    return (
      <>
        <NavItem closeOnSelect={closeOnSelect}>
          <Link
            to="/login"
            className="hover:text-foreground text-muted-foreground px-3 py-2 text-sm"
          >
            ログイン
          </Link>
        </NavItem>
        <NavItem closeOnSelect={closeOnSelect}>
          <Link
            to="/signup"
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3 py-2 text-sm font-medium"
          >
            新規登録
          </Link>
        </NavItem>
      </>
    )
  }

  return (
    <>
      <NavItem closeOnSelect={closeOnSelect}>
        <Link
          to="/forecast"
          className="hover:text-foreground text-muted-foreground px-3 py-2 text-sm"
        >
          予報とコーデ
        </Link>
      </NavItem>
      <span className="text-muted-foreground px-2 text-sm">{user.name}</span>
      <NavItem closeOnSelect={closeOnSelect}>
        <Button variant="outline" size="sm" onClick={onLogout}>
          ログアウト
        </Button>
      </NavItem>
    </>
  )
}

/**
 * ドロワー内では `SheetClose` で包み、押下時に閉じる。
 * ヘッダー(デスクトップ)ではドロワー自体が無いため、そのまま描画する。
 */
function NavItem({
  closeOnSelect,
  children,
}: {
  closeOnSelect: boolean
  children: ReactNode
}) {
  if (!closeOnSelect) {
    return <>{children}</>
  }

  return <SheetClose asChild>{children}</SheetClose>
}
