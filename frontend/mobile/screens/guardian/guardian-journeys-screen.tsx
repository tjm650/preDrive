import { AppScreen, ScreenHeading } from "@/components/ui";
import { GuardianJourneyList } from "@/components/guardian";

export default function GuardianJourneysScreen() {
  return (
    <AppScreen>
      <ScreenHeading title="Journey history" subtitle="Review scheduled and completed school journeys." />
      <GuardianJourneyList journeys={[]} />
    </AppScreen>
  );
}
