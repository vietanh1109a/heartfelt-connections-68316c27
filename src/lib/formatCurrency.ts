/**
 * Format a number as Vietnamese Dong currency.
 * e.g. 5000 → "5.000đ"
 */
export function formatCurrency(amount: number): string {
  return `${amount.toLocaleString("vi-VN")}đ`;
}

/**
 * Format a number of views (1 view = 500đ).
 * e.g. 10 → "10 lượt xem"
 */
export function formatViews(amount: number): string {
  const views = Math.floor(amount / 500);
  return `${views} lượt xem`;
}
