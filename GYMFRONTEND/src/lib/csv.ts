/**
 * Small CSV reader for the member import. Handles quoted fields, escaped
 * quotes and CRLF, which covers what Excel and Google Sheets export.
 */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      // Swallow the \n of a \r\n pair.
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim().length > 0));
}

export type ImportRow = {
  name: string;
  phone: string;
  plan: string;
  /** Populated when the row cannot be imported as-is. */
  problem?: string;
};

const HEADER_ALIASES: Record<string, "name" | "phone" | "plan"> = {
  name: "name",
  "full name": "name",
  member: "name",
  "member name": "name",
  phone: "phone",
  "phone number": "phone",
  mobile: "phone",
  msisdn: "phone",
  plan: "plan",
  package: "plan",
  membership: "plan",
};

/**
 * Maps a sheet onto member rows. A header line is used when present; without
 * one we fall back to name, phone, plan by position.
 */
export function readMemberSheet(text: string): {
  rows: ImportRow[];
  error?: string;
} {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], error: "That file is empty" };

  const first = table[0]!.map((cell) => cell.trim().toLowerCase());
  const hasHeader = first.some((cell) => cell in HEADER_ALIASES);

  let index = { name: 0, phone: 1, plan: 2 };
  if (hasHeader) {
    const found: Partial<typeof index> = {};
    first.forEach((cell, position) => {
      const key = HEADER_ALIASES[cell];
      if (key && found[key] === undefined) found[key] = position;
    });
    if (found.name === undefined || found.phone === undefined) {
      return {
        rows: [],
        error: "The sheet needs at least a name column and a phone column",
      };
    }
    index = {
      name: found.name,
      phone: found.phone,
      plan: found.plan ?? -1,
    };
  }

  const body = hasHeader ? table.slice(1) : table;
  const seen = new Set<string>();

  const rows = body.map<ImportRow>((cells) => {
    const name = (cells[index.name] ?? "").trim();
    const phone = (cells[index.phone] ?? "").trim();
    const plan = (index.plan >= 0 ? (cells[index.plan] ?? "") : "").trim();
    const digits = phone.replace(/\D/g, "");

    let problem: string | undefined;
    if (!name) problem = "Missing name";
    else if (digits.length < 10) problem = "Phone number looks wrong";
    else if (seen.has(digits)) problem = "Duplicate phone number";

    if (!problem) seen.add(digits);

    return { name, phone, plan: plan || "Monthly", problem };
  });

  return { rows };
}
