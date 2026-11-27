import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { WorkspaceForm } from '@/components/workspace-form';
export default async function OnboardingPage({searchParams}:{searchParams:Promise<{confirmed?:string}>}) {
  const {confirmed}=await searchParams;
  const client=await createServerSupabase();
  const {data:{user}}=await client.auth.getUser();
  if(!user) redirect('/admin/login');
  if(!user.email_confirmed_at) redirect('/admin/login?error=email_not_confirmed');
  const {data,error}=await client.from('workspace_members').select('workspace_id').eq('user_id',user.id).maybeSingle();
  if(!error && data) redirect('/admin');
  return <main className="account-page">{confirmed==='1'&&<p role="status">E-mel anda telah disahkan. Akaun penganjur anda sedia digunakan.</p>}<h1>Namakan ruang penganjur anda</h1><p>Gunakan nama anda, pasukan atau organisasi. Anda boleh mencipta lebih daripada satu acara dalam ruang ini.</p><WorkspaceForm /></main>;
}
