import { getSupabaseConfig } from './supabase/config';
import { eventAssetsBucket } from './supabase/project-routing';
export function safeEventAsset(value: string | null | undefined): string | null {
  if(!value) return null;
  try {
    const config=getSupabaseConfig(); if(!config) return null;
    const url=new URL(value), base=new URL(config.url);
    const prefix = `/storage/v1/object/public/${eventAssetsBucket()}/`;
    return url.origin===base.origin && url.pathname.startsWith(prefix) && /^[0-9a-f-]{36}\/[0-9a-f-]+\.(?:png|jpg|webp)$/i.test(url.pathname.slice(prefix.length)) && !url.search && !url.hash ? url.href : null;
  }catch{return null;}
}
