import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { authOrigin } from '@/lib/auth/urls';
export async function GET(request: NextRequest) {
  const url=new URL(request.url);
  const origin=authOrigin(request.url);
  function redirect(path: string) {
    const response=NextResponse.redirect(new URL(path,origin));
    response.headers.set('Cache-Control','private, no-store');
    response.headers.set('Referrer-Policy','no-referrer');
    return response;
  }
  const token=url.searchParams.get('token_hash'), code=url.searchParams.get('code');
  try {
    const client=await createServerSupabase();
    const result=token && url.searchParams.get('type')==='email'
      ? await client.auth.verifyOtp({token_hash:token,type:'email'})
      : code ? await client.auth.exchangeCodeForSession(code) : null;
    if(result && !result.error) return redirect('/onboarding?confirmed=1');
  } catch {}
  return redirect('/auth/confirmation-error');
}
