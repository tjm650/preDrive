import {StyleSheet,Text,View} from "react-native";
import type {Child} from "@predrive/shared/types";
import {colors} from "@predrive/shared/tokens";
import {AppCard} from "../ui/app-card";
export function GuardianChildCard({child,classNameLabel,tripStatus}:{child:Child;classNameLabel:string;tripStatus?:"not_boarded"|"on_board"|"dropped_off"|"absent"}){
 const statusLabel=tripStatus?.replace("_"," ")??"Not on a trip";
 return <AppCard style={s.card}><View style={s.avatar}><Text style={s.initials}>{child.firstName.slice(0,1)}{child.lastName.slice(0,1)}</Text></View><View style={s.details}><Text style={s.name}>{child.firstName} {child.lastName}</Text><Text style={s.className}>{classNameLabel}</Text><Text style={s.status}>{statusLabel}</Text></View></AppCard>;
}
const s=StyleSheet.create({card:{padding:16,flexDirection:"row",alignItems:"center",gap:14},avatar:{width:48,height:48,borderRadius:24,backgroundColor:colors.canvas,alignItems:"center",justifyContent:"center"},initials:{fontSize:16,fontWeight:"800",color:colors.ink},details:{flex:1,gap:3},name:{fontSize:17,fontWeight:"800",color:colors.ink},className:{fontSize:14,color:colors.ink,opacity:.7},status:{fontSize:14,fontWeight:"700",color:colors.info,textTransform:"capitalize"}});
