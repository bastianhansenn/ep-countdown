import { useCountdown } from '../hooks/useCountdown'

const UNITS = [
  ['days', 'DAYS'],
  ['hours', 'HOURS'],
  ['minutes', 'MINUTES'],
  ['seconds', 'SECONDS'],
] as const

export default function Countdown() {
  const state = useCountdown()

  return (
    <div>
      {state.released ? (
        <p className="text-3xl font-extralight uppercase tracking-[0.5em] text-white/90 md:text-4xl">
          Released
        </p>
      ) : (
        <div className="flex gap-6 md:gap-10">
          {UNITS.map(([key, label], i) => (
            <div
              key={key}
              className="animate-cd-reveal flex flex-col items-center"
              style={{ animationDelay: `${i * 0.5}s` }}
            >
              <span className="text-4xl font-extralight tabular-nums tracking-[0.15em] text-white/90 md:text-5xl">
                {String(state[key]).padStart(2, '0')}
              </span>
              <span className="mt-2 text-[10px] uppercase tracking-[0.45em] text-blue-200/60">
                {label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
