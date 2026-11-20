import {Tabs} from "expo-router";
import {RoleAccessGate} from "../../src/auth/role-access-gate";
export default function DriverLayout(){return <RoleAccessGate requiredRole="driver"><Tabs screenOptions={{headerShown:false,tabBarActiveTintColor:"#0F2A43",tabBarInactiveTintColor:"#647587",tabBarStyle:{height:64,paddingTop:8,paddingBottom:8}}}><Tabs.Screen name="index" options={{title:"Overview"}}/><Tabs.Screen name="route" options={{title:"Route"}}/><Tabs.Screen name="vehicle" options={{title:"Vehicle"}}/><Tabs.Screen name="safety" options={{title:"Safety"}}/></Tabs></RoleAccessGate>;}
