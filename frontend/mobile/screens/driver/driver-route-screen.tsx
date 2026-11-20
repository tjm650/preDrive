import { AppScreen, ScreenHeading } from "@/components/ui";
import { DriverRouteOverview } from "@/components/driver";

export default function DriverRouteScreen() {
  return (
    <AppScreen>
      <ScreenHeading title="Route" subtitle="Review your assigned route and ordered stops." />
      <DriverRouteOverview route={null} trip={null} />
    </AppScreen>
  );
}
