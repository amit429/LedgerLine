function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-md bg-secondary ${className}`} />;
}

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
        <Pulse className="h-64 flex-1" />
      </div>
      <Pulse className="h-72 w-full" />
    </div>
  );
}
