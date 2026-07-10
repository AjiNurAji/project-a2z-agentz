import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton variant="rectangular" className="h-12 w-64 rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton variant="rectangular" className="h-80 rounded-2xl" />
        <Skeleton variant="rectangular" className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}
