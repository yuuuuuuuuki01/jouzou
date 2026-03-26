export const BREW_SEASON_START = "2026-10-01";
export const BREW_SEASON_END = "2027-09-30";

export interface SeasonMonth {
  year: number;
  month: number;
  yearMonth: string;
}

export function getSeasonMonths(): SeasonMonth[] {
  const result: SeasonMonth[] = [];
  for (let index = 0; index < 12; index += 1) {
    const year = index < 3 ? 2026 : 2027;
    const month = ((index + 9) % 12) + 1;
    result.push({
      year,
      month,
      yearMonth: `${year}-${String(month).padStart(2, "0")}`
    });
  }
  return result;
}

export function formatYearMonth(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}
