import { notFound } from 'next/navigation';
import { getPublicEvent } from '@/lib/public-event';
import { PublicEvent } from '@/components/public-event';
export default async function EventPage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const event=await getPublicEvent(slug);if(!event)notFound();return <PublicEvent event={event}/>;}
