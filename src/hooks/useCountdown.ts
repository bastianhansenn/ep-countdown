import { useEffect, useState } from 'react'

// 23 October 2026, midnight local wall-clock time.
const TARGET = new Date(2026, 9, 23, 0, 0, 0)

export interface CountdownState {
  days: number
  hours: number
  minutes: number
  seconds: number
  released: boolean
}

function compute(): CountdownState {
  const diff = Math.max(0, TARGET.getTime() - Date.now())
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor(diff / 3_600_000) % 24,
    minutes: Math.floor(diff / 60_000) % 60,
    seconds: Math.floor(diff / 1_000) % 60,
    released: diff === 0,
  }
}

export function useCountdown(): CountdownState {
  const [state, setState] = useState<CountdownState>(compute)

  useEffect(() => {
    // Recompute the absolute delta every tick instead of counting down,
    // so tab throttling, sleep/wake, and DST shifts can never drift it.
    const id = setInterval(() => {
      const next = compute()
      setState((prev) =>
        prev.days === next.days &&
        prev.hours === next.hours &&
        prev.minutes === next.minutes &&
        prev.seconds === next.seconds &&
        prev.released === next.released
          ? prev
          : next,
      )
      if (next.released) clearInterval(id)
    }, 250)
    return () => clearInterval(id)
  }, [])

  return state
}
