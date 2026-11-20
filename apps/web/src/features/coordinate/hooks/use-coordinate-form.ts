import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { coordinatesUpsertSchema } from '@haregi/schema'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import {
  CoordinateConflictError,
  saveCoordinates,
  type Coordinate,
  type CoordinateValues,
} from '../api/coordinate-api.ts'
import { coordinateFormValues } from '../model/coordinate-week.ts'

const snapshotError =
  '最新の予報で保存できませんでした。時間をおいてもう一度保存してください。'

type Snapshot = {
  snapshotId: string | undefined
  refreshSnapshot: () => Promise<string>
}

async function saveWithSnapshot(
  request: CoordinateValues,
  refreshSnapshot: Snapshot['refreshSnapshot'],
) {
  try {
    return await saveCoordinates(request)
  } catch (error) {
    if (
      !(error instanceof CoordinateConflictError) ||
      error.code !== 'SNAPSHOT_UNAVAILABLE'
    ) {
      throw error
    }
  }

  const snapshotId = await refreshSnapshot().catch(() => undefined)
  if (!snapshotId || snapshotId === request.snapshotId) {
    throw new CoordinateConflictError('SNAPSHOT_UNAVAILABLE')
  }
  return saveCoordinates({ ...request, snapshotId })
}

export function useCoordinateForm(
  dates: string[],
  saved: Coordinate[],
  { snapshotId, refreshSnapshot }: Snapshot,
) {
  const [errorMessage, setErrorMessage] = useState<string>()
  const form = useForm({
    resolver: zodResolver(coordinatesUpsertSchema),
    defaultValues: coordinateFormValues(dates, saved),
  })
  const mutation = useMutation({
    mutationFn: ({
      request,
      refresh,
    }: {
      request: CoordinateValues
      refresh: Snapshot['refreshSnapshot']
    }) => saveWithSnapshot(request, refresh),
  })
  const onSubmit = form.handleSubmit(async ({ items }) => {
    setErrorMessage(undefined)
    const defaults = form.formState.defaultValues
    const changed = items.filter((item, index) => {
      const original = defaults?.items?.[index]
      return (
        item.outerwear !== original?.outerwear ||
        item.tops !== original?.tops ||
        item.bottoms !== original?.bottoms
      )
    })
    if (changed.length === 0) {
      form.reset(defaults)
      return
    }
    try {
      const rows = await mutation.mutateAsync({
        request: {
          items: changed,
          ...(snapshotId !== undefined && { snapshotId }),
        },
        refresh: refreshSnapshot,
      })
      const submittedDates = new Set(changed.map(({ date }) => date))
      const next = coordinateFormValues(dates, rows)
      // 送信した日が応答に含まれない場合は削除済みなので、空欄に戻す。
      form.reset({
        items: next.items.map((item, index) =>
          submittedDates.has(item.date)
            ? item
            : (defaults?.items?.[index] ?? item),
        ),
      })
      toast.success('コーデを保存しました')
    } catch (error) {
      if (
        error instanceof CoordinateConflictError &&
        error.code === 'VERSION_CONFLICT'
      ) {
        toast.error(
          'コーデが別の画面で更新されました。ページを再読み込みして編集し直してください。',
        )
        return
      }
      setErrorMessage(
        error instanceof CoordinateConflictError
          ? snapshotError
          : 'コーデを保存できませんでした。時間をおいてもう一度保存してください。',
      )
    }
  })
  return { form, onSubmit, errorMessage }
}
