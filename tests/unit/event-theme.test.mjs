import test from 'node:test';import assert from 'node:assert/strict';import { resolveEventTheme } from '../../lib/event-theme.ts';
test('event slogans remain text without interpreting URLs as embedded artwork',()=>{for(const text of ['An event theme','https://example.com/image.png','/theme.png'])assert.deepEqual(resolveEventTheme(` ${text} `),{kind:'text',text});});
test('optional blank themes remain hidden',()=>{for(const value of [null,undefined,'',' \n '])assert.equal(resolveEventTheme(value),null);});
