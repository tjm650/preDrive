import {useState} from "react";
import {StyleSheet,Text,View} from "react-native";
import type {LanguageCode} from "@predrive/shared/types";
import {colors} from "@predrive/shared/tokens";
import {AppScreen} from "../components/ui/app-screen";
import {ScreenHeading} from "../components/ui/screen-heading";
import {PasswordResetForm} from "../components/auth/password-reset-form";
import {getMobileAuthCopy} from "../components/auth/auth-copy";
import {AuthLanguageSelector} from "../components/auth/auth-language-selector";
export default function ForgotPasswordScreen(){
 const [language,setLanguage]=useState<LanguageCode>("en");const copy=getMobileAuthCopy(language);
 return <AppScreen contentStyle={s.content}><View style={s.brand}><Text style={s.brandName}>preDrive</Text><Text style={s.brandDescription}>{copy.brandDescription}</Text></View>
 <AuthLanguageSelector label={copy.languageLabel} value={language} onChange={setLanguage}/>
 <ScreenHeading title={copy.resetTitle} subtitle={copy.resetDescription}/><PasswordResetForm copy={copy}/></AppScreen>;
}
const s=StyleSheet.create({content:{flexGrow:1,justifyContent:"center",gap:24,paddingTop:36,paddingBottom:36},brand:{gap:4},brandName:{color:colors.ink,fontSize:32,fontWeight:"800",letterSpacing:-1},brandDescription:{color:colors.ink,opacity:0.72,fontSize:16}});
