import { useEffect } from 'react'
import { useBlocker } from '@tanstack/react-router'

export function useUnsavedCoordinateWarning(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return

    function warn(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = true
    }

    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [isDirty])

  return useBlocker({
    disabled: !isDirty,
    shouldBlockFn: ({ current, next }) => current.routeId !== next.routeId,
    enableBeforeUnload: false,
    withResolver: true,
  })
}
