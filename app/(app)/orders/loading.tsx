import { Pulse, TableSkeleton } from "@/components/shared/table-skeleton";

export default function OrdersLoading() {
  return (
    <>
      <div className="flex items-center justify-between border-b border-border bg-card px-7 py-3.5">
        <div className="flex flex-col gap-2">
          <Pulse className="h-5 w-32" />
          <Pulse className="h-3 w-24" />
        </div>
      </div>
      <div className="flex flex-col gap-3.5 p-7">
        <Pulse className="h-10 w-full" />
        <div className="rounded-lg border border-border bg-card">
          <TableSkeleton rows={10} cols={9} />
        </div>
      </div>
    </>
  );
}
