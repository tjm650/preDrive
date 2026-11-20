import {StyleSheet,View} from "react-native";
import {AppScreen} from "../ui/app-screen";
import {ScreenHeading} from "../ui/screen-heading";
import {FeedbackState} from "../ui/feedback-state";
export function WorkspaceStateScreen({title,subtitle,stateTitle,stateDescription}:{title:string;subtitle:string;stateTitle:string;stateDescription:string}){return <AppScreen contentStyle={s.content}><ScreenHeading title={title} subtitle={subtitle}/><View style={s.panel}><FeedbackState title={stateTitle} description={stateDescription}/></View></AppScreen>;}
const s=StyleSheet.create({content:{gap:20},panel:{flex:1,justifyContent:"center"}});
