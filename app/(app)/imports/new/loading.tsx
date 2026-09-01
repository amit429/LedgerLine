import { Pulse } from "@/components/shared/table-skeleton";

export default function NewImportLoading() {
  return (
    <div className="flex flex-1 items-center justify-center px-15">
      <div className="flex w-[760px] flex-col items-center gap-4">
        <Pulse className="h-7 w-72" />
        <Pulse className="h-4 w-full max-w-[560px]" />
        <div className="mt-2 flex w-full gap-4">
          <Pulse className="h-40 flex-1" />
          <Pulse className="h-40 flex-1" />
        </div>
      </div>
    </div>
  );
}
