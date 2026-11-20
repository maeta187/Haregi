import { Alert, AlertDescription } from '@/components/ui/alert.tsx'
import { Button } from '@/components/ui/button.tsx'
import { Skeleton } from '@/components/ui/skeleton.tsx'
import { ForecastTable } from '@/features/forecast/components/forecast-table.tsx'
import type { Forecast } from '@/features/forecast/api/forecast-api.ts'
import type { Coordinate } from '../api/coordinate-api.ts'
import { useCoordinateForm } from '../hooks/use-coordinate-form.ts'
import { useCoordinateWeek } from '../hooks/use-coordinate-week.ts'
import { useUnsavedCoordinateWarning } from '../hooks/use-unsaved-coordinate-warning.ts'
import { UnsavedCoordinateDialog } from './unsaved-coordinate-dialog.tsx'
import { CoordinateForm } from './coordinate-form.tsx'

type Props = {
  userId: string
  forecast: Forecast | undefined
  snapshotId: string | undefined
  refreshSnapshot: () => Promise<string>
}

export function CoordinateSection({ userId, ...forecast }: Props) {
  const { dates, query } = useCoordinateWeek(userId)
  if (query.isError) {
    return (
      <>
        {forecast.forecast && <ForecastTable days={forecast.forecast.days} />}
        <div className="flex flex-col items-start gap-3">
          <Alert variant="destructive">
            <AlertDescription>コーデを読み込めませんでした</AlertDescription>
          </Alert>
          <Button
            variant="outline"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            コーデを再読み込み
          </Button>
        </div>
      </>
    )
  }
  if (query.data === undefined) {
    return (
      <output className="flex min-h-svh flex-col gap-4">
        <p>コーデを読み込んでいます</p>
        <Skeleton
          aria-hidden="true"
          className="h-32 w-full motion-reduce:animate-none"
        />
      </output>
    )
  }
  return (
    <CoordinateEditor
      key={userId}
      dates={dates}
      saved={query.data}
      {...forecast}
    />
  )
}

function CoordinateEditor({
  dates,
  saved,
  forecast,
  snapshotId,
  refreshSnapshot,
}: Omit<Props, 'userId'> & { dates: string[]; saved: Coordinate[] }) {
  const editor = useCoordinateForm(dates, saved, {
    snapshotId,
    refreshSnapshot,
  })
  const blocker = useUnsavedCoordinateWarning(editor.form.formState.isDirty)
  return (
    <>
      <CoordinateForm dates={dates} forecast={forecast} {...editor} />
      {blocker.status === 'blocked' && (
        <UnsavedCoordinateDialog
          onStay={blocker.reset}
          onLeave={blocker.proceed}
        />
      )}
    </>
  )
}
