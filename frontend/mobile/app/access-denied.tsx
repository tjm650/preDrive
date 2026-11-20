import {StyleSheet,Text} from "react-native";
import {useRouter} from "expo-router";
import {colors} from "@predrive/shared/tokens";
import {AppScreen} from "../components/ui/app-screen";
import {ScreenHeading} from "../components/ui/screen-heading";
import {ActionButton} from "../components/ui/action-button";
export default function AccessDeniedScreen(){const router=useRouter();return <AppScreen contentStyle={s.content}>
 <ScreenHeading title="Access restricted" subtitle="This account does not have permission to open this workspace."/>
 <ActionButton label="Return to sign in" onPress={()=>router.replace("/signin")}/>
 <Text style={s.note}>If you believe this is an error, contact your school administrator.</Text>
 </AppScreen>;}
const s=StyleSheet.create({content:{justifyContent:"center"},note:{color:colors.ink,opacity:0.75,fontSize:16,lineHeight:22,textAlign:"center"}});
