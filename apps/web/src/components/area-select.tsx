import { areas } from '@haregi/schema'
import type { ComponentProps, Ref } from 'react'

import { cn } from '@/lib/utils'

/**
 * 気象庁の府県予報区(全58区分)を選ぶセレクタ。
 *
 * shadcn/ui の Select ではなくネイティブの `<select>` を使う。選択肢が58件あり、
 * モバイルでは OS のピッカーが出るネイティブ要素のほうがタップ数・スクロール量が
 * 少ないため(persona.md「入力が面倒だと続かない」)。
 */
type AreaSelectProps = Omit<ComponentProps<'select'>, 'children'> & {
  ref?: Ref<HTMLSelectElement>
}

export function AreaSelect({ className, ...props }: AreaSelectProps) {
  return (
    <select
      data-slot="area-select"
      className={cn(
        'border-input bg-transparent dark:bg-input/30 flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base shadow-xs outline-none',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
        'disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className,
      )}
      {...props}
    >
      <option value="">選択してください</option>
      {areas.map((area) => (
        <option key={area.code} value={area.code}>
          {area.name}
        </option>
      ))}
    </select>
  )
}
