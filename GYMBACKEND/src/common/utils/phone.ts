/**
 * Nigerian numbers arrive as "0803 214 7765", "08032147765" or "+2348032147765"
 * and are all the same person. Storing the normalised form keeps the unique
 * index honest and makes sign-in forgiving.
 */
export function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");

  if (digits.startsWith("234") && digits.length === 13) {
    return `0${digits.slice(3)}`;
  }
  if (digits.length === 10) return `0${digits}`;

  return digits;
}

/** Display form: "08032147765" -> "0803 214 7765". */
export function formatPhone(phone: string): string {
  const digits = normalisePhone(phone);
  if (digits.length !== 11) return digits;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
}
