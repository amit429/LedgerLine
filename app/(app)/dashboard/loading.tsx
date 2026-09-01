import { Pulse } from "@/components/shared/table-skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-5 p-7">
      <Pulse className="h-16 w-full" />
      <div className="flex gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Pulse key={i} className="h-24 flex-1" />
        ))}
      </div>
      <div className="flex gap-4">
        <Pulse className="h-64 flex-[0_0_460px]" />
        <div className="flex flex-1 flex-col gap-4">
          <Pulse className="h-64 w-full" />
          <Pulse className="h-48 w-full" />
        </div>
      </div>
      <Pulse className="h-72 w-full" />
    </div>
  );
}
