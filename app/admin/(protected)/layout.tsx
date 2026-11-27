import { requireAdmin } from '@/lib/auth/admin';
import { Suspense } from 'react';
import { OrganizerWorkspace } from '@/components/organizer-workspace';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <Suspense fallback={<p className="p-8" role="status">Memuatkan ruang penganjur…</p>}><OrganizerWorkspace>{children}</OrganizerWorkspace></Suspense>;
}
