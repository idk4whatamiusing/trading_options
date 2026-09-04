import { OrderHistory } from "../_components/order-history";

export default function Page() {
  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <OrderHistory />
    </div>
  );
}
