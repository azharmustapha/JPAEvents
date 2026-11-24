import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
export async function GET(request: NextRequest) {
  const url=new URL(request.url);
  const token=url.searchParams.get('token_hash'), code=url.searchParams.get('code');
  try {
    const client=await createServerSupabase();
    const result=token && url.searchParams.get('type')==='email'
      ? await client.auth.verifyOtp({token_hash:token,type:'email'})
      : code ? await client.auth.exchangeCodeForSession(code) : null;
    if(result && !result.error) return NextResponse.redirect(new URL('/onboarding',request.url));
  } catch {}
  return NextResponse.redirect(new URL('/admin/login?error=email_not_confirmed',request.url));
}
