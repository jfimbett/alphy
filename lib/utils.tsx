// lib/utils.ts
export function formatCIK(cik: string): string {
    return cik.padStart(10, '0');
  }

  // lib/utils.ts
export function cn(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}
