import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { eventPath } from '@/lib/events';
export default async function LegacyDisplay({searchParams}:{searchParams:Promise<{event?:string}>}){const {event}=await searchParams;if(event){const client=await createServerSupabase();const {data}=await client.from('perhimpunan').select('slug').eq('id',event).eq('published',true).maybeSingle();if(data?.slug)redirect(eventPath(data.slug,'tayangan'));}redirect('/admin');}
