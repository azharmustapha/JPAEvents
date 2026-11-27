export type CatalogStatus = 'all' | 'published' | 'draft' | 'open';
type CatalogEvent = {
  tajuk: string; organizer_name?: string; kod_sesi: string; lokasi: string;
  published?: boolean; status_aktif: boolean;
};

export function filterEventCatalog<T extends CatalogEvent>(events: T[], query: string, status: CatalogStatus): T[] {
  const search = query.trim().toLocaleLowerCase('ms');
  return events.filter(event => {
    const matchesStatus = status === 'all' || (status === 'published' && event.published) ||
      (status === 'draft' && !event.published) || (status === 'open' && event.published && event.status_aktif);
    return matchesStatus && (!search || [event.tajuk, event.organizer_name, event.kod_sesi, event.lokasi]
      .some(value => value?.toLocaleLowerCase('ms').includes(search)));
  });
}
