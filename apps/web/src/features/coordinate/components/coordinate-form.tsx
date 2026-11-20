import type { FormEventHandler } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { formatJstDate, formatTemperature } from '@haregi/schema'
import { Alert, AlertDescription } from '@/components/ui/alert.tsx'
import { Button } from '@/components/ui/button.tsx'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field.tsx'
import { Input } from '@/components/ui/input.tsx'
import type { Forecast } from '@/features/forecast/api/forecast-api.ts'
import type { CoordinateValues } from '../api/coordinate-api.ts'

const clothingFields = [
  ['outerwear', 'アウター'],
  ['tops', 'トップス'],
  ['bottoms', 'ボトムス'],
] as const

type Props = {
  dates: string[]
  forecast: Forecast | undefined
  form: UseFormReturn<CoordinateValues>
  errorMessage: string | undefined
  onSubmit: FormEventHandler<HTMLFormElement>
}

export function CoordinateForm({
  dates,
  forecast,
  form,
  onSubmit,
  errorMessage,
}: Props) {
  const { errors, isDirty, isSubmitting } = form.formState
  return (
    <form aria-labelledby="coordinate-heading" onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <div>
          <h2
            id="coordinate-heading"
            className="font-heading text-xl font-semibold"
          >
            コーデ入力
          </h2>
          <p className="text-muted-foreground text-sm">
            各項目は50文字以内です。
          </p>
        </div>
        {dates.map((date, index) => {
          const day = forecast?.days.find((entry) => entry.date === date)
          return (
            <FieldSet key={date} className="rounded-lg border p-4">
              <FieldLegend variant="label">
                <time dateTime={date}>{formatJstDate(date)}</time>
              </FieldLegend>
              <p className="text-muted-foreground flex flex-wrap gap-x-4 text-sm tabular-nums">
                <span>
                  最高気温{' '}
                  {day?.maxTemperature != null
                    ? formatTemperature(day.maxTemperature)
                    : '—'}
                </span>
                <span>
                  最低気温{' '}
                  {day?.minTemperature != null
                    ? formatTemperature(day.minTemperature)
                    : '—'}
                </span>
              </p>
              <FieldGroup className="gap-3 sm:grid sm:grid-cols-3">
                {clothingFields.map(([field, label]) => {
                  const id = `coordinate-${date}-${field}`
                  const error = errors.items?.[index]?.[field]
                  return (
                    <Field
                      key={field}
                      data-invalid={!!error}
                      className="min-w-0 gap-1"
                    >
                      <FieldLabel htmlFor={id}>{label}</FieldLabel>
                      <Input
                        id={id}
                        readOnly={isSubmitting}
                        aria-invalid={!!error}
                        aria-describedby={error ? `${id}-error` : undefined}
                        {...form.register(`items.${index}.${field}`)}
                      />
                      <FieldError id={`${id}-error`} errors={[error]} />
                    </Field>
                  )
                })}
              </FieldGroup>
            </FieldSet>
          )
        })}
        {errorMessage && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}
        <Button
          type="submit"
          disabled={!isDirty || isSubmitting}
          className="self-start"
        >
          {isSubmitting ? '保存中…' : 'コーデを保存'}
        </Button>
      </FieldGroup>
    </form>
  )
}
