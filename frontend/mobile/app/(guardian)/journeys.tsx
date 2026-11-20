import { AppScreen, ScreenHeading } from "../../components/ui";
import { GuardianJourneyList } from "../../components/guardian";

export default function GuardianJourneys() {
  return (
    <AppScreen>
      <ScreenHeading title="Journey history" subtitle="Review scheduled and completed school journeys." />
      <GuardianJourneyList journeys={[]} />
    </AppScreen>
  );
}
