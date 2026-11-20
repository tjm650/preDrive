import {Pressable,StyleSheet,Text,View} from "react-native";
import type {LanguageCode} from "@predrive/shared/types";
import {usePreDriveI18n} from "@predrive/shared/i18n";
import {colors} from "@predrive/shared/tokens";
const choices:{value:LanguageCode;label:string}[]=[{value:"en",label:"English"},{value:"sn",label:"Shona"},{value:"nd",label:"Ndebele"}];
export function LanguagePreferenceControl(){
 const {language,setLanguage,ready}=usePreDriveI18n();
 return <View style={styles.container}>
  <Text style={styles.title}>App language</Text>
  <View style={styles.options}>{choices.map(choice=><Pressable key={choice.value} accessibilityRole="radio" accessibilityState={{checked:language===choice.value,disabled:!ready}} disabled={!ready} onPress={()=>void setLanguage(choice.value)} style={[styles.option,language===choice.value&&styles.selected]}><Text style={[styles.label,language===choice.value&&styles.selectedLabel]}>{choice.label}</Text></Pressable>)}</View>
  <Text style={styles.note}>Your language choice stays active for this session. Profile-based saving will be available when secure account services are connected.</Text>
 </View>;
}
const styles=StyleSheet.create({container:{gap:12,borderWidth:1,borderColor:colors.line,borderRadius:12,backgroundColor:colors.surface,padding:16},title:{color:colors.ink,fontSize:16,fontWeight:"700"},options:{flexDirection:"row",gap:8},option:{flex:1,minHeight:44,alignItems:"center",justifyContent:"center",borderRadius:22,borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface,paddingHorizontal:8},selected:{borderColor:colors.ink,backgroundColor:colors.ink},label:{color:colors.ink,fontSize:14,fontWeight:"600"},selectedLabel:{color:colors.surface},note:{color:colors.ink,opacity:.7,fontSize:13,lineHeight:19}});
