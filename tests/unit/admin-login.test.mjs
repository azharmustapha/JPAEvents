import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyAdminLogin, waitForLogin, getLoginMessage } from '../../lib/auth/login.ts';

const user = { id: 'admin-id' };
function client({ authError = null, membership = {user_id:'admin-id'}, membershipError = null, session = {user}, signOutError = null } = {}) {
  const state = { credentials: null, lookup: null, signedOut: null };
  return { state, auth: {
    signInWithPassword: async credentials => { state.credentials = credentials; return {data:{user,session},error:authError}; },
    signOut: async options => { state.signedOut = options; if(signOutError) throw signOutError; return {error:null}; },
  }, from(table) {
    assert.equal(table,'workspace_members');
    return {select(columns) { assert.equal(columns,'user_id'); return {eq(column, id) {
      state.lookup = {column,id}; return {maybeSingle:async()=>({data:membership,error:membershipError})};
    }}; }};
  }};
}

test('only authenticated admin members succeed; emails are trimmed and passwords preserved', async () => {
  const db = client();
  assert.deepEqual(await verifyAdminLogin(db,' admin@example.com ',' password '), {ok:true});
  assert.deepEqual(db.state.credentials,{email:'admin@example.com',password:' password '});
  assert.deepEqual(db.state.lookup,{column:'user_id',id:'admin-id'});
  assert.equal(db.state.signedOut,null);
});

test('invalid credentials, unconfirmed email, rate limits and transport failures have different results', async () => {
  for(const [error, reason] of [
    [{code:'invalid_credentials',status:400},'invalid_credentials'],
    [{code:'email_not_confirmed',status:400},'email_not_confirmed'],
    [{code:'over_request_rate_limit',status:429},'rate_limited'],
    [{name:'AuthRetryableFetchError',status:0},'unavailable'],
    [{status:503},'unavailable'],
  ]) {
    const db=client({authError:error});
    assert.deepEqual(await verifyAdminLogin(db,'admin@example.com','password'),{ok:false,reason});
    assert.equal(db.state.lookup,null);
  }
  assert.notEqual(getLoginMessage('unavailable'),getLoginMessage('invalid_credentials'));
});

test('missing or mismatched sessions never reach the membership check', async () => {
  for(const session of [null,{user:{id:'other-id'}}]) {
    const db=client({session});
    assert.deepEqual(await verifyAdminLogin(db,'admin@example.com','password'),{ok:false,reason:'unavailable'});
    assert.equal(db.state.lookup,null);
  }
});

test('nonmembers and failed membership checks sign out only the new local session', async () => {
  for(const [options,reason] of [[{membership:{user_id:'other-id'}},'denied'],[{membershipError:{code:'NETWORK'}},'access_unavailable']]) {
    const db=client(options);
    assert.deepEqual(await verifyAdminLogin(db,'admin@example.com','password'),{ok:false,reason});
    assert.deepEqual(db.state.signedOut,{scope:'local'});
  }
});

test('a cleanup failure cannot turn denied access into success', async () => {
  const db=client({membership:{user_id:'other-id'},signOutError:new Error('offline')});
  assert.deepEqual(await verifyAdminLogin(db,'admin@example.com','password'),{ok:false,reason:'denied'});
});

test('a stalled login ends on abort and a late success cannot replace the timeout', async () => {
  const controller=new AbortController();
  let finish;
  const pending=new Promise(resolve=>{finish=resolve;});
  const result=waitForLogin(pending,controller.signal);
  controller.abort(new DOMException('Timed out','TimeoutError'));
  assert.deepEqual(await result,{ok:false,reason:'timeout'});
  finish({ok:true});
  assert.deepEqual(await result,{ok:false,reason:'timeout'});
});

test('a successful login completes without waiting for the deadline', async () => {
  assert.deepEqual(await waitForLogin(Promise.resolve({ok:true}),new AbortController().signal),{ok:true});
});

test('new authenticated organizers can log in before creating a workspace', async()=>{assert.deepEqual(await verifyAdminLogin(client({membership:null}),'new@example.com','password'),{ok:true});});
