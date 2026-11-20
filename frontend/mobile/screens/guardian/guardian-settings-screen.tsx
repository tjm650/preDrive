import { AppScreen, ScreenHeading, LanguagePreferenceControl } from "@/components/ui";
import { GuardianAccountSummary, GuardianNotificationSettings } from "@/components/guardian";

export default function GuardianSettingsScreen() {
  return (
    <AppScreen>
      <ScreenHeading title="Account and settings" subtitle="Manage your guardian account and communication preferences." />
      <GuardianAccountSummary profile={null} school={null} />
      <GuardianNotificationSettings preferences={null} />
      <LanguagePreferenceControl />
    </AppScreen>
  );
}
