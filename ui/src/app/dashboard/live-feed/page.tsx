import { LiveEventFeed } from "../_components/live-event-feed";

export default function Page() {
  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <LiveEventFeed />
    </div>
  );
}
