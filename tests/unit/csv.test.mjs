import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeCsvCell } from '../../lib/csv.ts';
test('escapes CSV quotes, commas and newlines', () => {
  assert.equal(escapeCsvCell('Unit "A", HQ\nFloor 2'),'"Unit ""A"", HQ\nFloor 2"');
});
test('neutralizes formulas after whitespace or controls', () => {
  for (const value of ['=1+1',' +1','\t@SUM(A1)','-1','\r=1']) {
    assert.equal(escapeCsvCell(value).startsWith('"\''),true);
  }
  assert.equal(escapeCsvCell('ALI'),'"ALI"');
});
