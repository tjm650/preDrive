import Head from "next/head";
import {AuthPanel} from "../components/auth/AuthPanel";
import {SignInForm} from "../components/auth/SignInForm";
import {getAuthCopy} from "../components/auth/auth-copy";
import {useAuthLanguage} from "../lib/auth-language";
export default function SignInPage(){const {language,setLanguage}=useAuthLanguage();const copy=getAuthCopy(language);return <><Head><title>Sign in | preDrive</title><meta name="robots" content="noindex,nofollow"/></Head><AuthPanel copy={copy} language={language} onLanguageChange={setLanguage}><SignInForm copy={copy}/></AuthPanel></>;}
