import { describe, expect, it } from 'vitest'
import { escapeCsvCell, toCsv } from '@/lib/csv'

describe('admin CSV exports', () => {
  it('neutralises spreadsheet formulas in customer-supplied text', () => {
    expect(escapeCsvCell('=HYPERLINK("http://x","click")')).toBe(`"'=HYPERLINK(""http://x"",""click"")"`)
    expect(escapeCsvCell('+1 555 0100')).toBe("'+1 555 0100")
    expect(escapeCsvCell('@SUM(A1)')).toBe("'@SUM(A1)")
  })
  it('leaves numbers and ordinary text alone', () => {
    expect(escapeCsvCell(-5)).toBe('-5')
    expect(escapeCsvCell('Jane Doe')).toBe('Jane Doe')
    expect(toCsv([{ a: 'x,y', b: 2 }])).toBe('a,b\n"x,y",2')
  })
})
