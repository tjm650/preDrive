import type {AppProps} from "next/app";
import {Bricolage_Grotesque,DM_Sans} from "next/font/google";
import {PreDriveI18nProvider,createBrowserLanguageStorage} from "@predrive/shared/i18n";
import "../styles/globals.css";
const heading=Bricolage_Grotesque({subsets:["latin"],variable:"--font-heading",display:"swap"});
const body=DM_Sans({subsets:["latin"],variable:"--font-body",display:"swap"});
const languageStorage=createBrowserLanguageStorage();
export default function App({Component,pageProps}:AppProps){
 return <div className={`${heading.variable} ${body.variable}`}><PreDriveI18nProvider storage={languageStorage}><Component {...pageProps}/></PreDriveI18nProvider></div>;
}
