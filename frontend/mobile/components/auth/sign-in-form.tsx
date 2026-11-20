import {useState} from "react";
import {StyleSheet,Text,View} from "react-native";
import {Link} from "expo-router";
import {colors} from "@predrive/shared/tokens";
import {ActionButton} from "../ui/action-button";
import {AppCard} from "../ui/app-card";
import {AuthTextField} from "./auth-text-field";
import type {MobileAuthCopy} from "./auth-copy";
export function SignInForm({copy}:{copy:MobileAuthCopy}){
 const [email,setEmail]=useState("");const [password,setPassword]=useState("");const [emailError,setEmailError]=useState("");const [passwordError,setPasswordError]=useState("");const [unavailable,setUnavailable]=useState(false);
 function submit(){const normalized=email.trim();const valid=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);setEmailError(!normalized?copy.emailRequired:!valid?copy.emailInvalid:"");setPasswordError(password?"":copy.passwordRequired);setUnavailable(false);if(!normalized||!valid||!password)return;setUnavailable(true);}
 return <AppCard style={s.card}><View style={s.fields}>
 <AuthTextField label={copy.emailLabel} placeholder={copy.emailPlaceholder} value={email} onChangeText={v=>{setEmail(v);setEmailError("");setUnavailable(false);}} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" error={emailError}/>
 <AuthTextField label={copy.passwordLabel} placeholder={copy.passwordPlaceholder} value={password} onChangeText={v=>{setPassword(v);setPasswordError("");setUnavailable(false);}} secureTextEntry showPasswordLabel={copy.showPassword} hidePasswordLabel={copy.hidePassword} autoComplete="current-password" textContentType="password" error={passwordError}/>
 </View><View style={s.recovery}><Link href="/forgot-password" style={s.link}>{copy.forgotPassword}</Link></View>
 <ActionButton label={copy.signInAction} onPress={submit}/>
 {unavailable?<View accessibilityRole="alert" style={s.notice}><Text style={s.noticeTitle}>{copy.serviceUnavailableTitle}</Text><Text style={s.noticeBody}>{copy.serviceUnavailableDescription}</Text></View>:null}
 </AppCard>;
}
const s=StyleSheet.create({card:{padding:20,gap:20},fields:{gap:18},recovery:{alignItems:"flex-end"},link:{minHeight:44,textAlignVertical:"center",color:colors.ink,fontSize:16,fontWeight:"700",textDecorationLine:"underline"},notice:{padding:14,gap:6,borderWidth:1,borderColor:colors.warning,borderRadius:12,backgroundColor:colors.canvas},noticeTitle:{color:colors.ink,fontSize:16,fontWeight:"700"},noticeBody:{color:colors.ink,fontSize:16,lineHeight:22}});
