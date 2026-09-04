import { TradeExecutionTable } from "../_components/trade-execution-table";

export default function Page() {
  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <TradeExecutionTable />
    </div>
  );
}
