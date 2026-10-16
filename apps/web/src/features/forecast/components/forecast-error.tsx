import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert.tsx'
import { Button } from '@/components/ui/button.tsx'

export function ForecastError({ onRetry }: { onRetry: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>予報を取得できませんでした</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        <p>時間をおいて、もう一度お試しください。</p>
        <Button type="button" variant="outline" onClick={onRetry}>
          再試行
        </Button>
      </AlertDescription>
    </Alert>
  )
}
