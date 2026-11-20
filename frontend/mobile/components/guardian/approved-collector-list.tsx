import {StyleSheet,Text,View} from "react-native";
import type {ApprovedCollector} from "@predrive/shared/types";
import {colors} from "@predrive/shared/tokens";
import {AppCard} from "../ui/app-card";
export function ApprovedCollectorList({collectors}:{collectors:ApprovedCollector[]}){
 if(collectors.length===0)return <AppCard style={s.empty}><Text style={s.title}>No approved collectors</Text><Text style={s.body}>Ask your school to help you register an authorised collector before a handover is needed.</Text></AppCard>;
 return <View style={s.list}>{collectors.map(person=><AppCard key={person.id} style={s.card}><Text style={s.name}>{person.fullName}</Text><Text style={s.body}>{person.relationship.replace("_"," ")} · {person.phone}</Text><Text style={s.active}>{person.active?"Approved":"Inactive"}</Text></AppCard>)}</View>;
}
const s=StyleSheet.create({list:{gap:10},card:{padding:15,gap:5},empty:{padding:16,gap:6},title:{fontSize:16,fontWeight:"800",color:colors.ink},name:{fontSize:16,fontWeight:"700",color:colors.ink},body:{fontSize:14,lineHeight:20,color:colors.ink,opacity:.72},active:{fontSize:13,fontWeight:"700",color:colors.success}});
