import test from 'node:test';
import assert from 'node:assert/strict';
import { routeProjectRequest, eventAssetsBucket, projectFetch, usesSharedProject, authCookieOptions } from '../../lib/supabase/project-routing.ts';

test('shared project routes only known event resources to isolated names', () => {
  const base = 'https://project.supabase.co';
  assert.equal(routeProjectRequest(`${base}/rest/v1/workspace_members?select=user_id`, base, true), `${base}/rest/v1/jpaevents_workspace_members?select=user_id`);
  assert.equal(routeProjectRequest(`${base}/rest/v1/rpc/get_passport`, base, true), `${base}/rest/v1/rpc/jpaevents_get_passport`);
  for (const url of [`${base}/auth/v1/token`, `${base}/rest/v1/other_app`, `${base}/rest/v1/jpaevents_perhimpunan`, 'https://other.supabase.co/rest/v1/perhimpunan']) assert.equal(routeProjectRequest(url, base, true), url);
});
test('dedicated installations retain the existing API and bucket names', () => {
  const url='https://project.supabase.co/rest/v1/perhimpunan';
  assert.equal(routeProjectRequest(url,'https://project.supabase.co',false),url);
  assert.equal(eventAssetsBucket(false),'event-assets');
  assert.equal(eventAssetsBucket(true),'jpaevents-event-assets');
});

test('transport preserves request bodies, headers and abort deadlines', async () => {
  const saved=process.env.NEXT_PUBLIC_JPAEVENTS_SHARED_PROJECT;
  process.env.NEXT_PUBLIC_JPAEVENTS_SHARED_PROJECT='true';
  try {
    const controller=new AbortController();
    const send=projectFetch('https://project.supabase.co',async (input,init)=>{
      const request=new Request(input,init);
      assert.equal(request.url,'https://project.supabase.co/rest/v1/rpc/jpaevents_save_event');
      assert.equal(request.headers.get('x-test'),'present');
      assert.equal(await request.text(),'{"event_id":null}');
      assert.equal(init.signal,controller.signal);
      return Response.json(null);
    });
    await send(new Request('https://project.supabase.co/rest/v1/rpc/save_event',{method:'POST',headers:{'x-test':'present'},body:'{"event_id":null}'}),{signal:controller.signal});
  } finally {
    if(saved===undefined)delete process.env.NEXT_PUBLIC_JPAEVENTS_SHARED_PROJECT;
    else process.env.NEXT_PUBLIC_JPAEVENTS_SHARED_PROJECT=saved;
  }
});

test('invalid deployment mode fails instead of querying another application', () => {
  const saved=process.env.NEXT_PUBLIC_JPAEVENTS_SHARED_PROJECT;
  try {
    process.env.NEXT_PUBLIC_JPAEVENTS_SHARED_PROJECT='shared';
    assert.throws(()=>usesSharedProject(),/true or false/);
    assert.equal(authCookieOptions.name,'jpaevents-auth');
  } finally {
    if(saved===undefined)delete process.env.NEXT_PUBLIC_JPAEVENTS_SHARED_PROJECT;
    else process.env.NEXT_PUBLIC_JPAEVENTS_SHARED_PROJECT=saved;
  }
});
