import {useState} from "react";
import {StyleSheet,Text,View} from "react-native";
import {Link} from "expo-router";
import {colors} from "@predrive/shared/tokens";
import {ActionButton} from "../ui/action-button";
import {AppCard} from "../ui/app-card";
import {AuthTextField} from "./auth-text-field";
import type {MobileAuthCopy} from "./auth-copy";
export function PasswordResetForm({copy}:{copy:MobileAuthCopy}){
 const [email,setEmail]=useState("");const [error,setError]=useState("");const [unavailable,setUnavailable]=useState(false);
 function submit(){const value=email.trim();if(!value){setError(copy.emailRequired);setUnavailable(false);return;}if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)){setError(copy.emailInvalid);setUnavailable(false);return;}setError("");setUnavailable(true);}
 return <AppCard style={s.card}><AuthTextField label={copy.emailLabel} placeholder={copy.emailPlaceholder} value={email} onChangeText={v=>{setEmail(v);setError("");setUnavailable(false);}} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" error={error}/>
 <ActionButton label={copy.sendResetLink} onPress={submit}/>
 {unavailable?<View accessibilityRole="alert" style={s.notice}><Text style={s.noticeTitle}>{copy.resetUnavailableTitle}</Text><Text style={s.noticeBody}>{copy.resetUnavailableDescription}</Text></View>:null}
 <Link href="/signin" style={s.link}>{copy.backToSignIn}</Link></AppCard>;
}
const s=StyleSheet.create({card:{padding:20,gap:20},notice:{padding:14,gap:6,borderWidth:1,borderColor:colors.warning,borderRadius:12,backgroundColor:colors.canvas},noticeTitle:{color:colors.ink,fontSize:16,fontWeight:"700"},noticeBody:{color:colors.ink,fontSize:16,lineHeight:22},link:{minHeight:44,textAlign:"center",textAlignVertical:"center",color:colors.ink,fontSize:16,fontWeight:"700",textDecorationLine:"underline"}});
