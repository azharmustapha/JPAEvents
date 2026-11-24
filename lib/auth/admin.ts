import 'server-only';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { withAuthTimeout } from './timeout';
export async function requireAdmin(): Promise<{ userId: string }> {
  const result=await withAuthTimeout(async signal=>{
    const client=await createServerSupabase(signal);
    const {data:{user},error:authError}=await client.auth.getUser();
    if(!user) return {state:authError && ![400,401,403].includes(authError.status??0)?'unavailable':'login',id:null};
    if(!user.email_confirmed_at) return {state:'email_not_confirmed',id:null};
    const {data,error}=await client.from('workspace_members').select('user_id').eq('user_id',user.id).maybeSingle();
    return {state:error?'unavailable':data?.user_id===user.id?'allowed':'onboarding',id:user.id};
  }).catch(()=>({state:'unavailable',id:null}));
  if(result.state==='onboarding') redirect('/onboarding');
  if(result.state!=='allowed'||!result.id) redirect(result.state==='login'?'/admin/login':`/admin/login?error=${result.state}`);
  return {userId:result.id};
}
