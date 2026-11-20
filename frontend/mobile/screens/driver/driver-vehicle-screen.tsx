import { AppScreen, FeedbackState, ScreenHeading } from "@/components/ui";
import { VehicleInspectionForm } from "@/components/driver";

export default function DriverVehicleScreen() {
  return (
    <AppScreen>
      <ScreenHeading title="Vehicle inspection" subtitle="Complete each safety check before departure." />
      <FeedbackState title="Vehicle assignment unavailable" description="A vehicle must be assigned to your account before an inspection can be recorded." />
      <VehicleInspectionForm />
    </AppScreen>
  );
}
