import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
if(process.env.TEST_APP_URL){for(const path of ['/admin','/admin/sesi-baru','/admin/tentatif','/admin/imbas','/admin/cabutan']){
 const response=await fetch(new URL(path,process.env.TEST_APP_URL),{redirect:'manual',headers:{Cookie:'forged_admin_session=true'}});
 assert.ok([302,303,307,308].includes(response.status));assert.equal(new URL(response.headers.get('location'),process.env.TEST_APP_URL).pathname,'/admin/login');
}console.log('PASS: protected routes reject anonymous and forged sessions.');}else console.log('SKIPPED: route checks need TEST_APP_URL.');
const required=['TEST_SUPABASE_URL','TEST_SUPABASE_ANON_KEY','TEST_ADMIN_EMAIL','TEST_ADMIN_PASSWORD'];
if(required.some(key=>!process.env[key])){console.log('SKIPPED: hosted Auth checks need dedicated test configuration and a verified organizer with a workspace.');process.exit(0);}
const client=createClient(process.env.TEST_SUPABASE_URL,process.env.TEST_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
try{
 const wrong=await client.auth.signInWithPassword({email:process.env.TEST_ADMIN_EMAIL,password:'deliberately-wrong-test-password'});assert.ok(wrong.error);
 const {data,error}=await client.auth.signInWithPassword({email:process.env.TEST_ADMIN_EMAIL,password:process.env.TEST_ADMIN_PASSWORD});assert.equal(error,null);
 const membership=await client.from('workspace_members').select('workspace_id,user_id');assert.equal(membership.error,null);assert.ok(membership.data.length);assert.ok(membership.data.every(row=>row.user_id===data.user.id));
 const {error:signOutError}=await client.auth.signOut();assert.equal(signOutError,null);assert.equal((await client.auth.getSession()).data.session,null);
 console.log('PASS: invalid password rejection, organizer identity/membership isolation and sign-out.');
}finally{await client.auth.signOut();}
