import { Skeleton } from '@/components/ui/skeleton';

/** 服务状态加载占位：标题与三张项目卡骨架，不联网。 */
export default function StatusLoading() {
  return (
    <div className="mx-auto w-full max-w-site px-4 py-8 md:px-8 xl:px-16" aria-busy="true">
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }, (_unused, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }, (_unused, index) => (
            <div key={index} className="space-y-4 rounded-card border border-border bg-card p-5">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-6 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
