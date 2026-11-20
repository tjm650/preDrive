import {useState} from "react";
import {Pressable,StyleSheet,Text,TextInput,View,type TextInputProps} from "react-native";
import {colors} from "@predrive/shared/tokens";
interface Props {label:string;value:string;onChangeText:(value:string)=>void;placeholder:string;error?:string;secureTextEntry?:boolean;showPasswordLabel?:string;hidePasswordLabel?:string;keyboardType?:TextInputProps["keyboardType"];autoComplete?:TextInputProps["autoComplete"];textContentType?:TextInputProps["textContentType"];}
export function AuthTextField(p:Props){
 const [visible,setVisible]=useState(false);
 return <View style={s.container}><Text style={s.label}>{p.label}</Text><View style={[s.shell,p.error?s.invalid:undefined]}>
 <TextInput accessibilityLabel={p.label} autoCapitalize="none" autoCorrect={false} autoComplete={p.autoComplete} textContentType={p.textContentType} keyboardType={p.keyboardType??"default"} value={p.value} onChangeText={p.onChangeText} placeholder={p.placeholder} placeholderTextColor="#647587" secureTextEntry={Boolean(p.secureTextEntry&&!visible)} style={s.input} selectionColor={colors.ink}/>
 {p.secureTextEntry?<Pressable accessibilityRole="button" accessibilityLabel={visible?p.hidePasswordLabel:p.showPasswordLabel} hitSlop={8} onPress={()=>setVisible(v=>!v)} style={s.visibility}><Text style={s.visibilityText}>{visible?p.hidePasswordLabel:p.showPasswordLabel}</Text></Pressable>:null}
 </View>{p.error?<Text accessibilityRole="alert" style={s.error}>{p.error}</Text>:null}</View>;
}
const s=StyleSheet.create({container:{gap:8},label:{color:colors.ink,fontSize:16,fontWeight:"700"},shell:{minHeight:52,flexDirection:"row",alignItems:"center",borderWidth:1,borderColor:colors.line,borderRadius:12,backgroundColor:colors.surface,paddingHorizontal:14},invalid:{borderColor:colors.danger},input:{flex:1,minWidth:0,minHeight:50,color:colors.ink,fontSize:16,paddingVertical:12},visibility:{minWidth:44,minHeight:44,alignItems:"center",justifyContent:"center"},visibilityText:{color:colors.ink,fontSize:14,fontWeight:"700"},error:{color:colors.danger,fontSize:14,lineHeight:19}});
