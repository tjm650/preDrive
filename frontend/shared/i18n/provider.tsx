import {createContext,useCallback,useContext,useEffect,useMemo,useState,type ReactNode} from "react";
import i18next,{type i18n} from "i18next";
import en from "./en.json";
import sn from "./sn.json";
import nd from "./nd.json";
import type {LanguageCode} from "../types/common";

export interface LanguageStorage {
  getLanguage():Promise<LanguageCode|null>;
  setLanguage(language:LanguageCode):Promise<void>;
}
export interface PreDriveI18nContextValue {
  language:LanguageCode;
  ready:boolean;
  setLanguage(language:LanguageCode):Promise<void>;
  t(key:string,options?:Record<string,string|number>):string;
}
const resources={en:{translation:en},sn:{translation:sn},nd:{translation:nd}};
const Context=createContext<PreDriveI18nContextValue|null>(null);
const isLanguageCode=(value:unknown):value is LanguageCode=>value==="en"||value==="sn"||value==="nd";

export function PreDriveI18nProvider({children,storage,initialLanguage="en"}:{children:ReactNode;storage?:LanguageStorage;initialLanguage?:LanguageCode}){
  const [instance]=useState<i18n>(()=>i18next.createInstance());
  const [language,setLanguageState]=useState<LanguageCode>(initialLanguage);
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    let active=true;
    void (async()=>{
      let preferred:LanguageCode=initialLanguage;
      if(storage){try{const saved=await storage.getLanguage();if(isLanguageCode(saved))preferred=saved;}catch{/* Continue with the safe default. */}}
      await instance.init({resources,lng:preferred,fallbackLng:"en",supportedLngs:["en","sn","nd"],interpolation:{escapeValue:false},returnNull:false});
      if(active){setLanguageState(preferred);setReady(true);}
    })();
    return()=>{active=false;};
  },[initialLanguage,instance,storage]);
  const setLanguage=useCallback(async(next:LanguageCode)=>{
    await instance.changeLanguage(next);
    setLanguageState(next);
    if(storage){try{await storage.setLanguage(next);}catch{/* Keep the selected language for this session. */}}
  },[instance,storage]);
  const t=useCallback((key:string,options?:Record<string,string|number>)=>String(instance.t(key,options)),[instance,language]);
  const value=useMemo(()=>({language,ready,setLanguage,t}),[language,ready,setLanguage,t]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function usePreDriveI18n():PreDriveI18nContextValue{
  const value=useContext(Context);
  if(!value)throw new Error("usePreDriveI18n must be used inside PreDriveI18nProvider");
  return value;
}
export function createBrowserLanguageStorage(key="predrive.language"):LanguageStorage{
  return {
    async getLanguage(){try{const value=window.localStorage.getItem(key);return isLanguageCode(value)?value:null;}catch{return null;}},
    async setLanguage(language){try{window.localStorage.setItem(key,language);}catch{/* Browser storage can be unavailable. */}}
  };
}
export const memoryLanguageStorage:LanguageStorage={
  async getLanguage(){return null;},
  async setLanguage(){/* Profile-backed persistence is added with the authenticated account service. */}
};
