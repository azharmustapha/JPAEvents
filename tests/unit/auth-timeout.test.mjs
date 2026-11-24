import test from 'node:test';
import assert from 'node:assert/strict';
import { withAuthTimeout } from '../../lib/auth/timeout.ts';

test('stalled authentication is aborted and a late reply cannot succeed',async()=>{
  let signal,finish;
  const result=withAuthTimeout(abortSignal=>{
    signal=abortSignal;
    return new Promise(resolve=>{finish=resolve;});
  },5);
  await assert.rejects(result,/timed out/i);
  assert.equal(signal.aborted,true);
  finish({allowed:true});
  await assert.rejects(result,/timed out/i);
});

test('fast authentication returns its actual result',async()=>{
  assert.deepEqual(await withAuthTimeout(async()=>({allowed:false}),1000),{allowed:false});
});

test('authentication errors are preserved for the caller to handle',async()=>{
  await assert.rejects(withAuthTimeout(async()=>{throw new Error('offline');}),/offline/);
});
