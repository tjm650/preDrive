import {useState} from "react";
import {ActivityIndicator,Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import type {ApprovedCollector} from "@predrive/shared/types";
import type {VerifyHandoverInput} from "@predrive/shared/lib/api";
import {colors} from "@predrive/shared/tokens";
import {ActionButton} from "../ui/action-button";
import {AppCard} from "../ui/app-card";

interface Props {
 tripId:string|null;
 childId:string|null;
 collectors:ApprovedCollector[];
 serviceAvailable:boolean;
 onVerify?:(input:VerifyHandoverInput)=>Promise<void>;
}
export function HandoverVerificationPanel({tripId,childId,collectors,serviceAvailable,onVerify}:Props){
 const [collectorId,setCollectorId]=useState("");
 const [pin,setPin]=useState("");
 const [submitting,setSubmitting]=useState(false);
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 const selected=collectors.find(item=>item.id===collectorId&&item.active);
 const ready=Boolean(serviceAvailable&&onVerify&&tripId&&childId&&selected&&/^\d{4,8}$/.test(pin)&&!submitting);
 const submit=async()=>{
  if(!ready||!onVerify||!tripId||!childId||!selected)return;
  setSubmitting(true);setError("");setMessage("");
  const verification:VerifyHandoverInput={tripId,childId,collectorId:selected.id,pin};
  try{await onVerify(verification);setMessage("Handover verified by the school service.");}
  catch{setError("Verification could not be completed. Check the PIN and try again.");}
  finally{setPin("");setSubmitting(false);}
 };
 return <AppCard style={s.card}>
  <Text style={s.title}>Gate handover</Text>
  <Text style={s.description}>Select the approved adult receiving the child. The PIN is checked by the school service and is never stored in this app.</Text>
  {!childId||!tripId?<Text style={s.notice}>Select a child on an active trip before verifying a handover.</Text>:null}
  {collectors.filter(item=>item.active).length===0?<Text style={s.notice}>No active approved collectors are available for this child.</Text>:null}
  <View style={s.collectors}>{collectors.filter(item=>item.active).map(person=><Pressable key={person.id} accessibilityRole="radio" accessibilityState={{checked:collectorId===person.id,disabled:!serviceAvailable}} disabled={!serviceAvailable} onPress={()=>{setCollectorId(person.id);setMessage("");setError("");}} style={[s.collector,collectorId===person.id&&s.collectorSelected]}><View style={s.person}><Text style={s.name}>{person.fullName}</Text><Text style={s.relationship}>{person.relationship.replace("_"," ")} · {person.phone}</Text></View><View style={[s.radio,collectorId===person.id&&s.radioSelected]}/></Pressable>)}</View>
  <Text style={s.label}>Handover PIN</Text>
  <TextInput value={pin} onChangeText={value=>{setPin(value.replace(/\D/g,"").slice(0,8));setError("");setMessage("");}} keyboardType="number-pad" secureTextEntry maxLength={8} editable={Boolean(serviceAvailable&&childId&&tripId&&!submitting)} placeholder="Enter 4–8 digit PIN" placeholderTextColor="#647587" accessibilityLabel="Handover PIN" style={s.pin}/>
  {!serviceAvailable?<Text style={s.notice}>PIN verification is unavailable until the secure school service is connected.</Text>:null}
  {message?<Text accessibilityRole="alert" style={s.success}>{message}</Text>:null}
  {error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}
  <ActionButton label={submitting?"Verifying…":"Verify handover"} onPress={submit} disabled={!ready} loading={submitting}/>
 </AppCard>;
}
const s=StyleSheet.create({card:{padding:16,gap:12},title:{fontSize:19,fontWeight:"800",color:colors.ink},description:{fontSize:14,lineHeight:20,color:colors.ink,opacity:.72},notice:{fontSize:14,lineHeight:20,color:colors.warning},collectors:{gap:8},collector:{minHeight:62,borderWidth:1,borderColor:colors.line,borderRadius:10,padding:12,flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12},collectorSelected:{borderColor:colors.ink,backgroundColor:colors.canvas},person:{flex:1,gap:3},name:{fontSize:15,fontWeight:"700",color:colors.ink},relationship:{fontSize:13,color:colors.ink,opacity:.68},radio:{width:18,height:18,borderRadius:9,borderWidth:1.5,borderColor:colors.ink},radioSelected:{backgroundColor:colors.busYellow,borderWidth:5},label:{fontSize:14,fontWeight:"700",color:colors.ink},pin:{minHeight:48,borderWidth:1,borderColor:colors.line,borderRadius:10,paddingHorizontal:14,fontSize:20,letterSpacing:5,color:colors.ink,backgroundColor:colors.surface},success:{fontSize:14,color:colors.success},error:{fontSize:14,color:colors.danger}});
