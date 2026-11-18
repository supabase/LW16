// launch week starts on this day, and each day after it unlocks one launch
const FIRST = { year: 2026, month: 11, day: 6 }

// the days of the week, seen from a date given as YYYY-MM-DD. a day is locked until its date
export const weekOn = (today, count) =>
  Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(FIRST.year, FIRST.month, FIRST.day + index))
      .toISOString()
      .slice(0, 10)
    return { date, isLocked: today < date, isLive: today === date }
  })
