import { Skeleton } from '@/components/ui/skeleton';

/** 模型目录加载占位：6 张卡片骨架，不联网、不读环境配置。 */
export default function CatalogLoading() {
  return (
    <div className="mx-auto w-full max-w-site px-4 py-8 md:px-8 xl:px-16" aria-busy="true">
      <div className="space-y-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-control w-full max-w-md" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_unused, index) => (
            <div key={index} className="space-y-4 rounded-card border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <Skeleton className="size-9 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-40" />
                </div>
              </div>
              <Skeleton className="h-px w-full" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
