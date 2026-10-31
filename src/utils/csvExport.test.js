import { describe, expect, it } from 'vitest';
import { escapeCsvCell } from './csvExport';

describe('CSV セルの安全な出力', () => {
  it.each(['=1+1', '+1', '-1', '@SUM(A1)', ' \t=1+1', '\n@SUM(A1)'])(
    '文字列 %j を数式として実行させない', (value) => {
      expect(escapeCsvCell(value)).toBe(`"'${value}"`);
    },
  );

  it('通常の文字列、引用符、数値は CSV として出力する', () => {
    expect(escapeCsvCell('名前 "A"')).toBe('"名前 ""A"""');
    expect(escapeCsvCell(-42)).toBe('"-42"');
  });
});
