const TIME_ZONE = "Asia/Jakarta";

export function formatDate(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
): string {
  if (!value) return "Tanggal tidak tersedia";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Tanggal tidak tersedia";

  return new Intl.DateTimeFormat("id-ID", {
    ...options,
    timeZone: TIME_ZONE,
  }).format(date);
}
