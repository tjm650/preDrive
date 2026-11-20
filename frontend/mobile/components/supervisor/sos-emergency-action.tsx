import {useState} from "react";
import {StyleSheet,Text,View} from "react-native";
import {colors} from "@predrive/shared/tokens";
import {ActionButton} from "../ui/action-button";
import {AppCard} from "../ui/app-card";
interface Props {serviceAvailable:boolean;onRaise?:(input:{tripId?:string})=>Promise<void>;tripId?:string;}
export function SosEmergencyAction({serviceAvailable,onRaise,tripId}:Props){
 const [armed,setArmed]=useState(false);const [sending,setSending]=useState(false);const [error,setError]=useState("");const [sent,setSent]=useState(false);
 const confirm=async()=>{if(!serviceAvailable||!onRaise)return;if(!armed){setArmed(true);setError("");return;}setSending(true);setError("");try{await onRaise({tripId});setSent(true);setArmed(false);}catch{setError("The emergency alert could not be sent. Contact emergency services directly.");}finally{setSending(false);}};
 return <AppCard style={s.card}>
  <Text style={s.title}>Emergency SOS</Text>
  <Text style={s.description}>Use only when a child, passenger or staff member is in immediate danger. This alerts the school's emergency contacts when connected.</Text>
  {!serviceAvailable?<Text style={s.notice}>SOS delivery is not connected. If there is immediate danger, contact emergency services and the school directly.</Text>:null}
  {error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}
  {sent?<Text accessibilityRole="alert" style={s.success}>Emergency alert accepted by the school service.</Text>:null}
  {armed?<Text style={s.confirm}>Press again to confirm sending the emergency alert.</Text>:null}
  <ActionButton label={sending?"Sending alert…":armed?"Confirm emergency SOS":"Raise emergency SOS"} variant="danger" onPress={confirm} disabled={!serviceAvailable||!onRaise||sending} loading={sending}/>
  {armed&&!sending?<Text accessibilityRole="button" onPress={()=>setArmed(false)} style={s.cancel}>Cancel</Text>:null}
 </AppCard>;
}
const s=StyleSheet.create({card:{padding:16,gap:10,borderColor:"#E8C6C2"},title:{fontSize:19,fontWeight:"800",color:colors.danger},description:{fontSize:14,lineHeight:20,color:colors.ink,opacity:.75},notice:{fontSize:14,lineHeight:20,color:colors.warning},error:{fontSize:14,color:colors.danger},success:{fontSize:14,color:colors.success},confirm:{fontSize:14,fontWeight:"700",color:colors.danger},cancel:{minHeight:44,textAlign:"center",textAlignVertical:"center",fontSize:15,fontWeight:"700",color:colors.ink}});
