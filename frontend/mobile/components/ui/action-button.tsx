import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { colors } from "@predrive/shared/tokens";
interface Props { label:string;onPress:()=>void;variant?:"primary"|"secondary"|"outline"|"danger";disabled?:boolean;loading?:boolean; }
export function ActionButton({label,onPress,variant="primary",disabled=false,loading=false}:Props) {
 const palette={primary:[colors.ink,colors.ink,colors.surface],secondary:[colors.busYellow,colors.busYellow,colors.ink],outline:[colors.surface,colors.line,colors.ink],danger:[colors.danger,colors.danger,colors.surface]}[variant] as [string,string,string];
 const blocked=disabled||loading;
 return <Pressable accessibilityRole="button" accessibilityState={{disabled:blocked,busy:loading}} disabled={blocked} onPress={onPress} style={({pressed})=>[styles.button,{backgroundColor:palette[0],borderColor:palette[1],opacity:blocked?0.55:pressed?0.86:1}]}>
  {loading?<ActivityIndicator color={palette[2]}/>:<Text style={[styles.label,{color:palette[2]}]}>{label}</Text>}
 </Pressable>;
}
const styles=StyleSheet.create({button:{minHeight:48,paddingHorizontal:20,borderWidth:1,borderRadius:999,alignItems:"center",justifyContent:"center"},label:{fontSize:16,fontWeight:"700"}});
