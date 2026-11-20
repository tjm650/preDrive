import { AppScreen, ScreenHeading } from "@/components/ui";
import { DriverRouteOverview } from "@/components/driver";

export default function DriverHomeScreen() {
  return (
    <AppScreen>
      <ScreenHeading eyebrow="Driver workspace" title="Today's assignment" subtitle="Your assigned vehicle, route and trip status." />
      <DriverRouteOverview route={null} trip={null} />
    </AppScreen>
  );
}
