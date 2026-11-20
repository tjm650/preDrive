import { AppScreen, ScreenHeading } from "@/components/ui";
import { TeacherSafetyGuidance } from "@/components/teacher";

export default function TeacherSafetyScreen() {
  return (
    <AppScreen>
      <ScreenHeading eyebrow="TEACHER" title="Child safety" subtitle="Safeguarding guidance for your classroom." />
      <TeacherSafetyGuidance />
    </AppScreen>
  );
}
