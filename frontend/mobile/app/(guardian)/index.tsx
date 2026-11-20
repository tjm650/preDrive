import {StyleSheet,Text,View} from "react-native";
import {AppScreen} from "../../components/ui/app-screen";
import {ScreenHeading} from "../../components/ui/screen-heading";
import {FeedbackState} from "../../components/ui/feedback-state";
import {GuardianJourneyCard} from "../../components/guardian/guardian-journey-card";
import {colors} from "@predrive/shared/tokens";
export default function GuardianHome(){return <AppScreen contentStyle={s.content}><ScreenHeading title="Good day" subtitle="Your children's school transport at a glance."/><GuardianJourneyCard journey={null}/><View style={s.unavailable}><FeedbackState title="Guardian account not connected" description="Your linked children and journey updates will load after secure sign-in and school data are connected."/></View><Text style={s.privacy}>Vehicle location is shared only during an active trip.</Text></AppScreen>;}
const s=StyleSheet.create({content:{gap:18},unavailable:{borderTopWidth:1,borderTopColor:colors.line,paddingTop:12},privacy:{fontSize:13,lineHeight:18,color:colors.ink,opacity:.65,textAlign:"center"}});
