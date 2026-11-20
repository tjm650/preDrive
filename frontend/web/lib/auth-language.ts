import {useEffect,useState} from "react";
import type {LanguageCode} from "@predrive/shared/types";
const KEY="predrive.language";
export function useAuthLanguage(){
 const [language,setLanguageState]=useState<LanguageCode>("en");
 useEffect(()=>{try{const value=window.localStorage.getItem(KEY);if(value==="en"||value==="sn"||value==="nd")setLanguageState(value);}catch{/* Storage may be unavailable in restricted browsers. */}},[]);
 const setLanguage=(value:LanguageCode)=>{setLanguageState(value);try{window.localStorage.setItem(KEY,value);}catch{/* Language remains active for this session. */}};
 return {language,setLanguage};
}
