/**
 * フォーム全体に対するエラー(サーバーから返った失敗)の表示。
 * 各項目のエラーは FieldError が担う。
 */
export function FormError({ message }: { message?: string | undefined }) {
  if (!message) {
    return null
  }

  return (
    <p
      role="alert"
      className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
    >
      {message}
    </p>
  )
}
