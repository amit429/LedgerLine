function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-md bg-secondary ${className}`} />;
}

export default function ImportsLoading() {
  return (
    <div className="flex flex-col gap-4 p-7">
      <Pulse className="h-14 w-full" />
      <Pulse className="h-64 w-full" />
    </div>
  );
}
