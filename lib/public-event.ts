import 'server-only';
import { createServerSupabase } from '@/lib/supabase/server';
import type { Acara } from '@/types/database';
export async function getPublicEvent(slug:string):Promise<Acara|null>{
 const client=await createServerSupabase();
 const {data,error}=await client.from('perhimpunan').select('*').eq('slug',slug).eq('published',true).maybeSingle();
 if(error)throw new Error('Maklumat acara tidak dapat dimuatkan. Cuba lagi sebentar.');
 return data as Acara|null;
}
