import {useEffect,useState,type FormEvent} from "react";
import type {School} from "@predrive/shared/types";
import type {UpdateSchoolSettingsInput} from "@predrive/shared/api";
import {Button} from "../ui/Button";
import {Card} from "../ui/Card";
import {TextField} from "../ui/TextField";

interface Props{
 school:School|null;
 loading?:boolean;
 saving?:boolean;
 error?:string;
 onRetry?:()=>void;
 onSave?:(input:UpdateSchoolSettingsInput)=>Promise<void>;
}
export function SchoolSettingsWorkspace({school,loading=false,saving=false,error,onRetry,onSave}:Props){
 const [name,setName]=useState("");const [address,setAddress]=useState("");const [rate,setRate]=useState("");
 const [formError,setFormError]=useState("");const [saved,setSaved]=useState(false);const [submitting,setSubmitting]=useState(false);
 useEffect(()=>{if(!school)return;setName(school.name);setAddress(school.address);setRate(String(school.indicativeZigPerUsd));},[school]);
 const dirty=Boolean(school)&&(name!==school?.name||address!==school?.address||rate!==String(school?.indicativeZigPerUsd));
 const submit=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();setFormError("");setSaved(false);const numericRate=Number(rate);if(!onSave||!name.trim()||!address.trim()||!Number.isFinite(numericRate)||numericRate<=0){setFormError("Enter the school name, address and a positive indicative exchange rate.");return;}setSubmitting(true);try{await onSave({name:name.trim(),address:address.trim(),indicativeZigPerUsd:numericRate});setSaved(true);}catch{setFormError("School settings could not be saved. Your previous settings remain unchanged.");}finally{setSubmitting(false);}};
 if(loading)return <Card className="p-8 text-center text-sm text-ink/65" aria-live="polite">Loading school settings…</Card>;
 if(error)return <Card className="border-danger/30 p-6" role="alert"><h2 className="font-bold">Settings unavailable</h2><p className="mt-2 text-sm text-ink/70">{error}</p>{onRetry?<Button className="mt-4" variant="outline" onClick={onRetry}>Try again</Button>:null}</Card>;
 if(!school)return <Card className="p-8 text-center"><h2 className="font-bold">School profile not loaded</h2><p className="mt-2 text-sm text-ink/65">The authenticated school service must provide the active school's profile before it can be edited.</p>{onRetry?<Button className="mt-4" variant="outline" onClick={onRetry}>Try again</Button>:null}</Card>;
 return <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,.8fr)]">
  <Card className="p-5 sm:p-6"><div className="mb-5"><h2 className="text-lg font-bold">School profile</h2><p className="mt-1 text-sm text-ink/65">Official details shown to authorised school users.</p></div>
   <form onSubmit={submit} className="grid gap-5"><TextField label="School name" value={name} onChange={event=>setName(event.target.value)} required maxLength={120} disabled={!onSave||submitting||saving}/><TextField label="School address" value={address} onChange={event=>setAddress(event.target.value)} required maxLength={240} disabled={!onSave||submitting||saving} hint="Include suburb and city, for example Borrowdale, Harare."/><div className="grid gap-1.5"><label className="text-sm font-semibold" htmlFor="school-timezone">School time zone</label><input id="school-timezone" value="Africa/Harare (Zimbabwe)" readOnly className="min-h-12 rounded-xl border border-line bg-canvas px-3 text-base text-ink/70"/></div>
    <div className="border-t border-line pt-5"><h3 className="font-bold">Indicative currency rate</h3><p className="mt-1 text-sm leading-5 text-ink/65">Used to show a ZiG equivalent alongside USD fees. This is an indicative display rate, not a payment conversion or settlement rate.</p><div className="mt-4 max-w-sm"><TextField label="ZiG per US$1" type="number" min="0.01" step="0.01" value={rate} onChange={event=>setRate(event.target.value)} required disabled={!onSave||submitting||saving}/></div><div className="mt-3 rounded-xl bg-canvas p-4"><p className="text-xs font-semibold uppercase tracking-wide text-ink/60">Example display</p><p className="mt-2 font-display text-xl font-bold">US$100.00</p><p className="text-sm text-ink/65">ZiG {(Number(rate)>0?100*Number(rate):0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</p><p className="mt-1 text-xs text-ink/60">Indicative rate · 1 USD = {Number(rate)>0?Number(rate).toLocaleString("en-US",{maximumFractionDigits:2}):"—"} ZiG</p></div></div>
    {formError?<p role="alert" className="text-sm text-danger">{formError}</p>:null}{saved?<p role="status" className="text-sm font-semibold text-success">School settings saved.</p>:null}
    {!onSave?<p className="rounded-lg bg-canvas p-3 text-sm leading-5 text-ink/70">Editing is unavailable until the secure school settings service is connected.</p>:null}
    <div className="flex flex-wrap justify-end gap-3"><Button type="button" variant="outline" disabled={!dirty||submitting||saving} onClick={()=>{setName(school.name);setAddress(school.address);setRate(String(school.indicativeZigPerUsd));setFormError("");setSaved(false);}}>Discard changes</Button><Button type="submit" loading={submitting||saving} disabled={!onSave||!dirty||submitting||saving}>Save school settings</Button></div>
   </form>
  </Card>
  <div className="grid content-start gap-5"><Card className="p-5"><h2 className="font-bold">School operations</h2><dl className="mt-4 grid gap-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-ink/65">Account status</dt><dd className="font-semibold capitalize">{school.status}</dd></div><div className="flex justify-between gap-3"><dt className="text-ink/65">Time zone</dt><dd className="font-semibold">Africa/Harare</dd></div><div className="flex justify-between gap-3"><dt className="text-ink/65">Display currencies</dt><dd className="font-semibold">USD · ZiG</dd></div></dl></Card>
   <Card className="p-5"><h2 className="font-bold">Payment collection methods</h2><ul className="mt-4 grid gap-3 text-sm"><li className="flex items-center justify-between border-b border-line pb-3"><span>EcoCash</span><span className="text-xs font-semibold text-ink/55">Configuration pending</span></li><li className="flex items-center justify-between border-b border-line pb-3"><span>CBZ bank transfer</span><span className="text-xs font-semibold text-ink/55">Configuration pending</span></li><li className="flex items-center justify-between"><span>CABS bank transfer</span><span className="text-xs font-semibold text-ink/55">Configuration pending</span></li></ul><p className="mt-3 text-xs leading-5 text-ink/60">Payment account details and gateway credentials are configured through secure backend administration, not stored in this browser form.</p></Card>
   <Card className="p-5"><h2 className="font-bold">Language support</h2><p className="mt-2 text-sm leading-5 text-ink/65">preDrive supports English, Shona and Ndebele. Each user's language preference is managed in their account settings.</p></Card>
  </div>
 </div>;
}
