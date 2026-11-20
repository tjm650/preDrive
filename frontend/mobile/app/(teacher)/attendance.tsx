import { AppScreen, ScreenHeading } from "../../components/ui";
import { TeacherAttendanceRegister } from "../../components/teacher";

export default function TeacherAttendance() {
  return (
    <AppScreen>
      <ScreenHeading eyebrow="TEACHER" title="Class attendance" subtitle="Record and review attendance for your assigned learners." />
      <TeacherAttendanceRegister entries={[]} />
    </AppScreen>
  );
}
