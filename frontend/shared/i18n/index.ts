import i18next,{type i18n, type Resource} from "i18next";
import en from "./en.json";
import sn from "./sn.json";
import nd from "./nd.json";
import type {LanguageCode} from "../types/common";
const resources:Resource={en:{translation:en},sn:{translation:sn},nd:{translation:nd}};
export function createPreDriveI18n(language:LanguageCode="en"):i18n{
 const instance=i18next.createInstance();
 void instance.init({resources,lng:language,fallbackLng:"en",supportedLngs:["en","sn","nd"],interpolation:{escapeValue:false},returnNull:false});
 return instance;
}
export async function changePreDriveLanguage(instance:i18n,language:LanguageCode):Promise<void>{await instance.changeLanguage(language);}
export {resources};
