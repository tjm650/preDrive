import {useState,type FormEvent} from "react";
import type {AuthCopy} from "./auth-copy";
import {Button} from "../ui/Button";
import {TextField} from "../ui/TextField";
export function PasswordResetForm({copy,serviceUnavailable=true}:{copy:AuthCopy;serviceUnavailable?:boolean}){
 const [email,setEmail]=useState("");const [error,setError]=useState("");const [attempted,setAttempted]=useState(false);
 function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const value=email.trim();if(!value){setError(copy.requiredEmail);setAttempted(false);return;}if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)){setError(copy.invalidEmail);setAttempted(false);return;}setError("");setAttempted(true);}
 return <form onSubmit={submit} noValidate className="grid gap-5"><div><h1 className="font-display text-2xl font-extrabold text-ink">{copy.resetTitle}</h1><p className="mt-2 text-sm leading-6 text-ink/70">{copy.resetDescription}</p></div><TextField label={copy.emailLabel} type="email" autoComplete="email" value={email} onChange={e=>{setEmail(e.target.value);setError("");setAttempted(false);}} placeholder={copy.emailPlaceholder} error={error}/><Button type="submit" fullWidth disabled={serviceUnavailable}>{copy.sendResetLink}</Button>{serviceUnavailable&&attempted?<p role="status" className="rounded-lg border border-warning bg-[#FFF8E8] p-3 text-sm leading-5 text-ink">{copy.emailSentDescription}</p>:null}<a href="/signin" className="min-h-11 pt-3 text-center text-sm font-semibold text-ink underline">{copy.backToSignIn}</a></form>;
}
