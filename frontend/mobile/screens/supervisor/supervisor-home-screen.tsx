import { WorkspaceStateScreen } from "@/components/workspace/workspace-state-screen";

export default function SupervisorHomeScreen() {
  return (
    <WorkspaceStateScreen
      title="Supervisor"
      subtitle="Your assigned school transport duties."
      stateTitle="Supervisor workspace not connected"
      stateDescription="Your assigned trips and operational tasks will load after secure sign-in is connected."
    />
  );
}
