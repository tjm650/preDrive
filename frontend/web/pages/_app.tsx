import type {AppProps} from "next/app";
import {Bricolage_Grotesque,DM_Sans} from "next/font/google";
import "../styles/globals.css";
const heading=Bricolage_Grotesque({subsets:["latin"],variable:"--font-heading",display:"swap"});
const body=DM_Sans({subsets:["latin"],variable:"--font-body",display:"swap"});
export default function App({Component,pageProps}:AppProps){return <div className={`${heading.variable} ${body.variable}`}><Component {...pageProps}/></div>;}
