import Image from 'next/image';
export function BrandLogo({ src = '/jpaevents.svg', alt = 'JPAEvents' }: { src?: string; alt?: string }) {
  return <Image src={src} alt={alt} width={48} height={48} unoptimized className="h-12 w-12 shrink-0 rounded-xl object-contain" />;
}
