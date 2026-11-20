import { Tabs } from "expo-router";
import { RoleAccessGate } from "../../src/auth/role-access-gate";

export default function GuardianLayout() {
  return (
    <RoleAccessGate requiredRole="guardian">
      <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: "#0F2A43", tabBarInactiveTintColor: "#647587", tabBarStyle: { height: 64, paddingTop: 8, paddingBottom: 8 } }}>
        <Tabs.Screen name="index" options={{ title: "Home" }} />
        <Tabs.Screen name="journeys" options={{ title: "Journeys" }} />
        <Tabs.Screen name="children" options={{ title: "Children" }} />
        <Tabs.Screen name="fees" options={{ title: "Fees" }} />
        <Tabs.Screen name="settings" options={{ title: "Settings" }} />
      </Tabs>
    </RoleAccessGate>
  );
}
