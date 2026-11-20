import type {LanguageCode} from "@predrive/shared/types";
import type {AuthCopy} from "./auth-copy";
export function LanguageSelector({value,onChange,copy}:{value:LanguageCode;onChange:(v:LanguageCode)=>void;copy:AuthCopy}){
 return <label className="grid gap-1 text-sm font-semibold text-ink"><span>Language</span><select value={value} onChange={e=>onChange(e.target.value as LanguageCode)} className="min-h-11 rounded-lg border border-line bg-white px-3"><option value="en">{copy.languageEnglish}</option><option value="sn">{copy.languageShona}</option><option value="nd">{copy.languageNdebele}</option></select></label>;
}
