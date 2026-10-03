import { notFound } from 'next/navigation';

/** 语言前缀下不存在的地址统一交给 [locale]/not-found.tsx。 */
export default function CatchAllPage() {
  notFound();
}
