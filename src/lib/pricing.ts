// Tidyo prices in USD. Yearly plans are shown as a whole-dollar monthly price (rounded down from 10 months / 12).
export const MONTHLY = { essencial: 29, pro: 69, comercial1: 49, comercial2: 99, comercial3: 179 } as const;
/** monthly price → monthly price when billed yearly */
export const YEARLY_MONTH: Record<number, number> = { 29: 24, 69: 57, 49: 40, 99: 82, 179: 149, 94: 77 };
/** Pro + Comercial (até 5 contratos): 20% off, rounded down */
export const COMBO = 94;
export const perMonth = (monthly: number, yearly: boolean) => (yearly ? YEARLY_MONTH[monthly] ?? Math.floor((monthly * 10) / 12) : monthly);
export const perYear = (monthly: number) => perMonth(monthly, true) * 12;
