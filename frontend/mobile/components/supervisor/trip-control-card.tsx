import {Alert,StyleSheet,Text,View} from "react-native";
import type {Trip} from "@predrive/shared/types";
import {colors} from "@predrive/shared/tokens";
import {ActionButton} from "../ui/action-button";
import {AppCard} from "../ui/app-card";

interface Props {
 trip:Trip|null;
 routeLabel?:string;
 busRegistration?:string;
 onStartTrip?:()=>void;
 onEndTrip?:()=>void;
}

const statusLabel:Record<Trip["status"],string>={
 scheduled:"Scheduled",
 active:"In progress",
 completed:"Completed",
 cancelled:"Cancelled",
 attention_required:"Attention required"
};

export function TripControlCard({trip,routeLabel,busRegistration,onStartTrip,onEndTrip}:Props){
 if(!trip)return <AppCard style={s.card}><Text style={s.title}>No trip assigned</Text><Text style={s.description}>An authorised trip assignment will appear here when your supervisor account is connected.</Text></AppCard>;
 const active=trip.status==="active";
 const scheduled=trip.status==="scheduled";
 const handleEnd=()=>Alert.alert("End this trip?","Confirm that the trip has finished. Child accountability must be checked before ending.",[{text:"Keep trip active",style:"cancel"},{text:"End trip",style:"destructive",onPress:onEndTrip}]);
 return <AppCard style={s.card}>
  <View style={s.header}><Text style={s.eyebrow}>{trip.direction==="to_school"?"TO SCHOOL":"FROM SCHOOL"}</Text><View style={[s.badge,active?s.active:trip.status==="attention_required"?s.attention:s.neutral]}><Text style={s.badgeText}>{statusLabel[trip.status]}</Text></View></View>
  <Text style={s.title}>{routeLabel??"Assigned route"}</Text>
  <View style={s.details}><View style={s.detail}><Text style={s.detailLabel}>BUS</Text><Text style={s.detailValue}>{busRegistration??"Not assigned"}</Text></View><View style={s.detail}><Text style={s.detailLabel}>SCHEDULED</Text><Text style={s.detailValue}>{new Date(trip.scheduledAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</Text></View></View>
  {trip.status==="attention_required"?<Text style={s.warning}>This trip requires attention. Review the manifest and safety records.</Text>:null}
  {scheduled&&onStartTrip?<ActionButton label="Start trip" onPress={onStartTrip}/>:null}
  {active&&onEndTrip?<ActionButton label="End trip" variant="danger" onPress={handleEnd}/>:null}
  {!onStartTrip&&!onEndTrip?<Text style={s.unavailable}>Trip controls become available after the secure trip service is connected.</Text>:null}
  {active?<Text style={s.privacy}>Vehicle location is shared only while this trip is active.</Text>:null}
 </AppCard>;
}

const s=StyleSheet.create({
 card:{padding:18,gap:14},
 header:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
 eyebrow:{fontSize:12,fontWeight:"800",letterSpacing:.8,color:colors.ink,opacity:.65},
 badge:{borderRadius:999,paddingHorizontal:10,paddingVertical:6},
 active:{backgroundColor:"#E6F4ED"},
 attention:{backgroundColor:"#FCEBE8"},
 neutral:{backgroundColor:colors.canvas},
 badgeText:{fontSize:12,fontWeight:"700",color:colors.ink},
 title:{fontSize:21,fontWeight:"800",color:colors.ink},
 description:{fontSize:14,lineHeight:20,color:colors.ink,opacity:.72},
 details:{flexDirection:"row",gap:24},
 detail:{gap:4},
 detailLabel:{fontSize:11,fontWeight:"800",letterSpacing:.7,color:colors.ink,opacity:.55},
 detailValue:{fontSize:16,fontWeight:"700",color:colors.ink},
 warning:{fontSize:14,lineHeight:20,color:colors.danger},
 unavailable:{fontSize:14,lineHeight:20,color:colors.ink,opacity:.68},
 privacy:{fontSize:13,lineHeight:18,color:colors.ink,opacity:.68}
});
