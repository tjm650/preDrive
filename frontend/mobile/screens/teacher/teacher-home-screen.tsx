import { AppScreen, ScreenHeading } from "@/components/ui";
import { TeacherClassroomOverview, TeacherSafetyGuidance } from "@/components/teacher";

export default function TeacherHomeScreen() {
  return (
    <AppScreen>
      <ScreenHeading eyebrow="TEACHER" title="Classroom overview" subtitle="Your assigned class and daily learner responsibilities." />
      <TeacherClassroomOverview classGroup={null} teacher={null} />
      <TeacherSafetyGuidance />
    </AppScreen>
  );
}
