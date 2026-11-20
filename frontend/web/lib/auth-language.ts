import type {LanguageCode} from "@predrive/shared/types";
import {usePreDriveI18n} from "@predrive/shared/i18n";
export function useAuthLanguage(){
 const {language,setLanguage}=usePreDriveI18n();
 return {language,setLanguage:(value:LanguageCode)=>{void setLanguage(value);}};
}
