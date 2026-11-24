import pg from 'pg';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as pause } from 'node:timers/promises';
if(!process.env.TEST_DATABASE_URL||process.env.ALLOW_DATABASE_TESTS!=='true'){console.log('SKIPPED: concurrency checks need an explicitly disposable TEST_DATABASE_URL and ALLOW_DATABASE_TESTS=true.');process.exit(0);}
const ids=[randomUUID(),randomUUID()],workspaces=[],events=[],codes=ids.map(id=>'TEST-'+id);
const clients=Array.from({length:3},()=>new pg.Client({connectionString:process.env.TEST_DATABASE_URL,statement_timeout:15000}));
const [operator,first,second]=clients;let closePending;
await Promise.all(clients.map(client=>client.connect()));
async function begin(client,user){await client.query('BEGIN');await client.query('SET LOCAL ROLE authenticated');await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[user]);}
async function register(client,eventId,name){return client.query('SELECT public.register_event_attendance($1,$2,$3,$4,$5,$6)',[eventId,name,'',name.toLowerCase().replaceAll(' ','')+'@test.invalid',false,null]);}
try{
 for(const id of ids)await operator.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES ($1,$2,now())',[id,id+'@test.invalid']);
 for(let index=0;index<2;index++){const client=index?second:first;await begin(client,ids[index]);const workspace=(await client.query('SELECT public.create_workspace($1) AS id',['Concurrency test'])).rows[0].id;workspaces.push(workspace);const settings={workspace_id:workspace,tajuk:'Concurrency test',tarikh:'2026-11-24',masa_mula:'09:00',lokasi:'Test venue',kod_sesi:codes[index],slug:'test-'+ids[index],published:true,status_aktif:true};events.push((await client.query('SELECT public.save_event(null,$1::jsonb) AS id',[JSON.stringify(settings)])).rows[0].id);await client.query('COMMIT');}
 await Promise.all([register(first,events[0],'PARALLEL A'),register(second,events[0],'PARALLEL B')]);
 assert.deepEqual((await operator.query('SELECT no_pasport FROM public.kehadiran_peserta WHERE perhimpunan_id=$1 ORDER BY no_pasport',[events[0]])).rows.map(row=>Number(row.no_pasport)),[1,2]);
 console.log('PASS: concurrent registration allocates distinct event pass numbers.');
 await first.query('BEGIN');await first.query('SET LOCAL ROLE anon');await register(first,events[0],'LOCKED REGISTER');
 await begin(second,ids[0]);const pid=(await second.query('SELECT pg_backend_pid() AS id')).rows[0].id;
 closePending=second.query('SELECT public.set_registration_open($1,false)',[events[0]]).then(()=>null,error=>error);
 const deadline=Date.now()+5000;let locked=false;while(Date.now()<deadline){const row=(await operator.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0];if(row?.wait_event_type==='Lock'){locked=true;break;}await pause(50);}
 assert.ok(locked,'Closing must wait for accepted registration to finish');
 await first.query('COMMIT');const closeError=await closePending;if(closeError)throw closeError;await second.query('COMMIT');
 await assert.rejects(register(first,events[0],'TOO LATE'),{code:'P0001'});
 await register(first,events[1],'OTHER EVENT');
 assert.equal((await operator.query('SELECT status_aktif FROM public.perhimpunan WHERE id=$1',[events[1]])).rows[0].status_aktif,true);
 console.log('PASS: closure serializes registration and leaves another organizer event open.');
}finally{
 await first.query('ROLLBACK').catch(()=>{});if(closePending)await closePending;await second.query('ROLLBACK').catch(()=>{});
 await operator.query('BEGIN');try{
  for(const id of events)await operator.query('DELETE FROM public.perhimpunan WHERE id=$1',[id]);
  for(const id of workspaces){await operator.query('DELETE FROM public.workspace_members WHERE workspace_id=$1',[id]);await operator.query('DELETE FROM public.workspaces WHERE id=$1',[id]);}
  for(const id of ids)await operator.query('DELETE FROM auth.users WHERE id=$1',[id]);await operator.query('COMMIT');
 }catch(error){await operator.query('ROLLBACK');throw error;}finally{await Promise.all(clients.map(client=>client.end()));}
}
