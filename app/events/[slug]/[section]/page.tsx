import { notFound } from 'next/navigation';
import { getPublicEvent } from '@/lib/public-event';
import { PublicEvent } from '@/components/public-event';
export default async function EventSectionPage({params}:{params:Promise<{slug:string;section:string}>}){const {slug,section}=await params;if(!['daftar','atur-cara','tayangan'].includes(section))notFound();const event=await getPublicEvent(slug);if(!event)notFound();return <PublicEvent event={event} section={section as 'daftar'|'atur-cara'|'tayangan'}/>;}
