import { Tabs } from "expo-router";
import { RoleAccessGate } from "../../src/auth/role-access-gate";

export default function TeacherLayout() {
  return (
    <RoleAccessGate requiredRole="teacher">
      <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: "#0F2A43", tabBarInactiveTintColor: "#647587", tabBarStyle: { height: 64, paddingTop: 8, paddingBottom: 8 } }}>
        <Tabs.Screen name="index" options={{ title: "Overview" }} />
        <Tabs.Screen name="attendance" options={{ title: "Attendance" }} />
        <Tabs.Screen name="safety" options={{ title: "Safety" }} />
      </Tabs>
    </RoleAccessGate>
  );
}
