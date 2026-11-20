import { AppScreen, ScreenHeading, FeedbackState } from "../../components/ui";
import { GuardianLiveJourneyPanel } from "../../components/guardian";

export default function GuardianHome() {
  return (
    <AppScreen>
      <ScreenHeading eyebrow="Guardian" title="Your journeys" subtitle="See the status of your children's school transport." />
      <GuardianLiveJourneyPanel trip={null} route={null} connectivity="offline" arrivalRadius={1000} />
      <FeedbackState title="Children not connected" description="Linked children and their journey assignments will appear after secure sign-in and school data are connected." />
    </AppScreen>
  );
}
