import {Stack} from "expo-router/stack";
import {colors} from "@predrive/shared/tokens";
import {AuthSessionProvider} from "../src/auth/session";
export default function RootLayout(){return <AuthSessionProvider><Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:colors.canvas},animation:"fade"}}>
 <Stack.Screen name="index"/><Stack.Screen name="signin"/><Stack.Screen name="forgot-password"/><Stack.Screen name="access-denied"/><Stack.Screen name="(guardian)"/><Stack.Screen name="(supervisor)"/><Stack.Screen name="(driver)"/>
 </Stack></AuthSessionProvider>;}
