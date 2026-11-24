import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';
import * as login from '../../lib/auth/login.ts';
import * as projectRouting from '../../lib/supabase/project-routing.ts';

const require = createRequire(import.meta.url);
const nextServer = require('next/server');
const code = transpileModule(await readFile(new URL('../../app/api/admin/login/route.ts',import.meta.url),'utf8'),{
  compilerOptions:{module:ModuleKind.CommonJS,target:ScriptTarget.ES2017},
}).outputText;

function route({membership={user_id:'admin-id'},membershipError=null,pendingMembership=null,configured=true}={}) {
  const state={created:false};
  const exports={};
  new Function('exports','require',code)(exports,name=>{
    if(name==='next/server') return nextServer;
    if(name==='@/lib/auth/login') return login;
    if(name==='@/lib/supabase/project-routing') return projectRouting;
    if(name==='@/lib/supabase/config') return {getSupabaseConfig:()=>configured?{url:'https://test.supabase.co',key:'public-test-key'}:null};
    assert.equal(name,'@supabase/ssr');
    return {createServerClient(url,key,options) {
      state.created=true;
      return {auth:{signInWithPassword:async()=>{
        options.cookies.setAll([{name:'sb-test-auth-token',value:'test-session',options:{path:'/',sameSite:'lax'}}]);
        return {data:{user:{id:'admin-id'},session:{user:{id:'admin-id'}}},error:null};
      },signOut:async()=>({error:null})},from:()=>({select:()=>({eq:()=>({maybeSingle:()=>pendingMembership||Promise.resolve({data:membership,error:membershipError})})})})};
    }};
  });
  return {post:exports.POST,state};
}
function request(body={email:'admin@example.com',password:'test-password'},origin='https://app.test',signal) {
  return new nextServer.NextRequest('https://app.test/api/admin/login',{
    method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body),signal,
  });
}

test('successful admin login publishes cookies and returns a private response without credentials',async()=>{
  const response=await route().post(request());
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{ok:true});
  assert.match(response.headers.get('set-cookie'),/sb-test-auth-token=test-session/);
  assert.equal(response.headers.get('cache-control'),'private, no-store');
});

test('denied and unavailable membership do not publish the session created during authentication',async()=>{
  for(const [options,status,reason] of [[{membership:{user_id:'other-id'}},403,'denied'],[{membershipError:{code:'NETWORK'}},503,'access_unavailable']]) {
    const response=await route(options).post(request());
    assert.equal(response.status,status);
    assert.deepEqual(await response.json(),{ok:false,reason});
    assert.equal(response.headers.get('set-cookie'),null);
  }
});

test('a timed-out access lookup cannot publish cookies even after its late successful result',async()=>{
  const controller=new AbortController();
  let finish;
  const pendingMembership=new Promise(resolve=>{finish=resolve;});
  const responsePromise=route({pendingMembership}).post(request(undefined,undefined,controller.signal));
  await new Promise(resolve=>setImmediate(resolve));
  controller.abort();
  const response=await responsePromise;
  assert.equal(response.status,504);
  assert.deepEqual(await response.json(),{ok:false,reason:'timeout'});
  finish({data:{user_id:'admin-id'},error:null});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(response.headers.get('set-cookie'),null);
});

test('cross-origin submissions and malformed credentials are rejected before authentication',async()=>{
  const foreign=route();
  assert.equal((await foreign.post(request(undefined,'https://other.test'))).status,403);
  assert.equal(foreign.state.created,false);
  for(const body of [null,{}, {email:5,password:'test'}, {email:'admin@example.com',password:''}]) {
    const handler=route();
    assert.equal((await handler.post(request(body))).status,400);
    assert.equal(handler.state.created,false);
  }
});

test('missing configuration is a retryable failure rather than a successful login',async()=>{
  const handler=route({configured:false});
  const response=await handler.post(request());
  assert.equal(response.status,503);
  assert.deepEqual(await response.json(),{ok:false,reason:'unavailable'});
  assert.equal(handler.state.created,false);
});

test('a reverse proxy public host is accepted even when Next uses an internal request URL',async()=>{
  const response=await route().post(new nextServer.NextRequest('http://localhost:3000/api/admin/login',{
    method:'POST',headers:{origin:'https://app.example.test',host:'localhost:3000','x-forwarded-host':'app.example.test','content-type':'application/json'},
    body:JSON.stringify({email:'admin@example.com',password:'test-password'}),
  }));
  assert.equal(response.status,200);
});

test('first login publishes cookies so a new organizer can create a workspace',async()=>{const response=await route({membership:null}).post(request());assert.equal(response.status,200);assert.match(response.headers.get('set-cookie'),/sb-test-auth-token/);});
