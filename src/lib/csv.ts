/**
 * Tiny CSV utilities — avoid pulling in a dependency.
 */

export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  let str = String(value)
  // Formula injection: exports carry customer-typed text (names, emails,
  // addresses). A cell starting with = + - @ (or tab/CR) is executed as a
  // formula when an admin opens the file in Excel/Sheets. Prefix text cells
  // with ' so they stay text. Real numbers are left alone.
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`
  }
  // RFC 4180: quote if contains comma, quote, CR, or LF
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function toCsv(
  rows: Array<Record<string, unknown>>,
  headers?: string[],
): string {
  if (rows.length === 0) return (headers ?? []).join(',')
  const keys = headers ?? Object.keys(rows[0])
  const head = keys.map(escapeCsvCell).join(',')
  const body = rows
    .map((row) => keys.map((k) => escapeCsvCell(row[k])).join(','))
    .join('\n')
  return `${head}\n${body}`
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

/**
 * Parses a CSV string into an array of row objects. Handles quoted fields,
 * escaped quotes (""), and CR/LF line endings. The first non-empty row is
 * treated as headers.
 */
export function parseCsv(input: string): Array<Record<string, string>> {
  const rows = parseCsvRows(input)
  if (rows.length === 0) return []
  const headers = rows[0].map((h) => h.trim())
  const out: Array<Record<string, string>> = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    // Skip fully empty rows
    if (row.every((c) => c.trim() === '')) continue
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => {
      obj[h] = (row[idx] ?? '').trim()
    })
    out.push(obj)
  }
  return out
}

/**
 * Low-level CSV parser — returns a 2D array of cells. Handles quoted fields
 * with embedded commas, quotes (escaped as ""), and newlines.
 */
export function parseCsvRows(input: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  let i = 0
  const len = input.length

  while (i < len) {
    const ch = input[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < len && input[i + 1] === '"') {
          cell += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      cell += ch
      i++
      continue
    }
    if (ch === '"') {
      inQuotes = true
      i++
      continue
    }
    if (ch === ',') {
      row.push(cell)
      cell = ''
      i++
      continue
    }
    if (ch === '\r') {
      // treat CRLF or CR as row end
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      if (i + 1 < len && input[i + 1] === '\n') i += 2
      else i++
      continue
    }
    if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      i++
      continue
    }
    cell += ch
    i++
  }
  // flush trailing cell/row
  row.push(cell)
  // ignore trailing empty row caused by trailing newline
  if (!(row.length === 1 && row[0] === '')) {
    rows.push(row)
  }
  return rows
}
