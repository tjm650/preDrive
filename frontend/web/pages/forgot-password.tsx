import Head from "next/head";
import {AuthPanel} from "../components/auth/AuthPanel";
import {PasswordResetForm} from "../components/auth/PasswordResetForm";
import {getAuthCopy} from "../components/auth/auth-copy";
import {useAuthLanguage} from "../lib/auth-language";
export default function ForgotPasswordPage(){const {language,setLanguage}=useAuthLanguage();const copy=getAuthCopy(language);return <><Head><title>Reset password | preDrive</title><meta name="robots" content="noindex,nofollow"/></Head><AuthPanel copy={copy} language={language} onLanguageChange={setLanguage}><PasswordResetForm copy={copy}/></AuthPanel></>;}
