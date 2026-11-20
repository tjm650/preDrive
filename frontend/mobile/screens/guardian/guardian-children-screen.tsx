import { AppScreen, ScreenHeading } from "@/components/ui";
import { GuardianChildDirectory } from "@/components/guardian";

export default function GuardianChildrenScreen() {
  return (
    <AppScreen>
      <ScreenHeading title="My children" subtitle="Child profiles linked to your guardian account." />
      <GuardianChildDirectory children={[]} classGroupNames={{}} />
    </AppScreen>
  );
}
