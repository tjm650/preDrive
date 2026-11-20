import {StyleSheet,Text,View} from "react-native";
import type {Child,ChildTripRecord,ChildTripStatus} from "@predrive/shared/types";
import {colors} from "@predrive/shared/tokens";
import {ActionButton} from "../ui/action-button";
import {AppCard} from "../ui/app-card";

export interface SupervisorManifestItem {child:Child;record:ChildTripRecord;}
interface Props {items:SupervisorManifestItem[];onMarkOnBoard?:(childId:string)=>void;onMarkDroppedOff?:(childId:string)=>void;}
const statusLabels:Record<ChildTripStatus,string>={not_boarded:"Not boarded",on_board:"On board",dropped_off:"Dropped off",absent:"Absent"};
export function ChildManifestList({items,onMarkOnBoard,onMarkDroppedOff}:Props){
 if(items.length===0)return <AppCard style={s.empty}><Text style={s.title}>Manifest not available</Text><Text style={s.description}>The assigned trip's child manifest will load from the school's confirmed transport records. Do not record boarding without an assigned manifest.</Text></AppCard>;
 return <View style={s.list}>{items.map(({child,record})=>{
  const pending=record.confirmationPending;
  return <AppCard key={record.id} style={s.card}>
   <View style={s.row}><View style={s.child}><Text style={s.name}>{child.firstName} {child.lastName}</Text><Text style={s.classLabel}>Child transport record</Text></View><View style={[s.status,pending?s.pending:s.confirmed]}><Text style={s.statusText}>{pending?"Pending confirmation":statusLabels[record.status]}</Text></View></View>
   {record.status==="not_boarded"&&onMarkOnBoard?<ActionButton label="Record boarding" onPress={()=>onMarkOnBoard(child.id)}/>:null}
   {record.status==="on_board"&&onMarkDroppedOff?<ActionButton label="Record drop-off" variant="secondary" onPress={()=>onMarkDroppedOff(child.id)}/>:null}
   {pending?<Text style={s.pendingNote}>This action is awaiting server confirmation. Do not treat it as final.</Text>:null}
  </AppCard>;
 })}</View>;
}
const s=StyleSheet.create({list:{gap:10},empty:{padding:18,gap:8},card:{padding:15,gap:12},row:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10},child:{flex:1,gap:3},title:{fontSize:17,fontWeight:"800",color:colors.ink},description:{fontSize:16,lineHeight:22,color:colors.ink,opacity:.72},name:{fontSize:16,fontWeight:"800",color:colors.ink},classLabel:{fontSize:13,color:colors.ink,opacity:.6},status:{borderRadius:999,paddingHorizontal:10,paddingVertical:6},pending:{backgroundColor:"#FFF3D7"},confirmed:{backgroundColor:"#E6F4ED"},statusText:{fontSize:12,fontWeight:"700",color:colors.ink},pendingNote:{fontSize:13,lineHeight:18,color:colors.warning}});
