import { useRef } from 'react'
import { AlertDialog } from 'radix-ui'
import { Button } from '@/components/ui/button.tsx'

export function UnsavedCoordinateDialog({
  onStay,
  onLeave,
}: {
  onStay: () => void
  onLeave: () => void
}) {
  const previousFocus = useRef<HTMLElement | null>(null)
  return (
    <AlertDialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onStay()
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
        <AlertDialog.Content
          onOpenAutoFocus={() => {
            const focused = document.activeElement
            previousFocus.current =
              focused instanceof HTMLElement ? focused : null
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            previousFocus.current?.focus()
          }}
          className="bg-popover text-popover-foreground ring-foreground/10 fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-sm -translate-1/2 gap-3 rounded-xl p-5 shadow-lg ring-1"
        >
          <AlertDialog.Title className="font-heading text-base font-semibold">
            未保存の変更があります
          </AlertDialog.Title>
          <AlertDialog.Description className="text-muted-foreground text-sm">
            この画面を離れると、入力した変更が失われます。
          </AlertDialog.Description>
          <div className="flex flex-wrap justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="outline">編集を続ける</Button>
            </AlertDialog.Cancel>
            <Button variant="destructive" onClick={onLeave}>
              保存せずに離れる
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
