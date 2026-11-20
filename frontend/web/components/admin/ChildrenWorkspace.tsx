import {useMemo,useState,type FormEvent} from "react";
import type {Child,ClassGroup} from "@predrive/shared/types";
import type {CreateChildInput} from "@predrive/shared/api";
import {Button} from "../ui/Button";
import {Card} from "../ui/Card";
import {TextField} from "../ui/TextField";

interface Props {
 children:Child[];
 classes:ClassGroup[];
 loading?:boolean;
 error?:string;
 onRetry?:()=>void;
 onCreate?:(input:CreateChildInput)=>Promise<void>;
}
export function ChildrenWorkspace({children,classes,loading=false,error,onRetry,onCreate}:Props){
 const [query,setQuery]=useState("");
 const [firstName,setFirstName]=useState("");
 const [lastName,setLastName]=useState("");
 const [dateOfBirth,setDateOfBirth]=useState("");
 const [classGroupId,setClassGroupId]=useState("");
 const [formError,setFormError]=useState("");
 const [submitting,setSubmitting]=useState(false);
 const filtered=useMemo(()=>children.filter(child=>`${child.firstName} ${child.lastName}`.toLowerCase().includes(query.trim().toLowerCase())),[children,query]);
 const submit=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();setFormError("");
  if(!onCreate||!firstName.trim()||!lastName.trim()||!dateOfBirth||!classGroupId){setFormError("Complete all fields before submitting.");return;}
  setSubmitting(true);
  try{await onCreate({firstName:firstName.trim(),lastName:lastName.trim(),dateOfBirth,classGroupId});setFirstName("");setLastName("");setDateOfBirth("");setClassGroupId("");}
  catch{setFormError("The child record could not be saved. Check the details and try again.");}
  finally{setSubmitting(false);}
 };
 return <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
  <Card className="min-w-0 p-5">
   <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="text-lg font-bold text-ink">Child register</h2><p className="mt-1 text-sm text-ink/65">School-scoped learner records and class assignments.</p></div><span className="text-sm font-semibold text-ink/65">{children.length} records</span></div>
   <div className="mt-5"><TextField label="Search children" placeholder="Search by first or last name" value={query} onChange={event=>setQuery(event.target.value)} /></div>
   {loading?<div className="mt-6 animate-pulse rounded-xl bg-canvas p-8 text-center text-sm text-ink/65" aria-live="polite">Loading child records…</div>:error?<div className="mt-6 rounded-xl border border-danger/30 bg-danger/5 p-5" role="alert"><p className="font-semibold text-ink">Child records unavailable</p><p className="mt-1 text-sm text-ink/70">{error}</p>{onRetry?<Button className="mt-4" variant="outline" onClick={onRetry}>Try again</Button>:null}</div>:filtered.length===0?<div className="mt-6 rounded-xl border border-dashed border-line bg-canvas/60 px-5 py-12 text-center"><h3 className="font-bold text-ink">{query?"No matching children":"No child records loaded"}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink/65">{query?"Try a different name or clear your search.":"The register will populate when the authenticated school data service is connected. No sample learner records are displayed."}</p></div>:<div className="mt-5 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr className="border-b border-line text-xs uppercase tracking-wide text-ink/60"><th className="px-3 py-3">Child</th><th className="px-3 py-3">Date of birth</th><th className="px-3 py-3">Class</th><th className="px-3 py-3">Status</th></tr></thead><tbody>{filtered.map(child=><tr key={child.id} className="border-b border-line last:border-0"><td className="px-3 py-4 font-semibold">{child.firstName} {child.lastName}</td><td className="px-3 py-4">{child.dateOfBirth}</td><td className="px-3 py-4">{classes.find(group=>group.id===child.classGroupId)?.name??"Unassigned"}</td><td className="px-3 py-4 capitalize">{child.status}</td></tr>)}</tbody></table></div>}
  </Card>
  <Card className="h-fit p-5">
   <h2 className="text-lg font-bold text-ink">Add a child</h2><p className="mt-1 text-sm leading-6 text-ink/65">Create a learner record within the currently selected school.</p>
   <form className="mt-5 grid gap-4" onSubmit={submit}>
    <TextField label="First name" value={firstName} onChange={event=>setFirstName(event.target.value)} autoComplete="given-name" required disabled={!onCreate||submitting}/>
    <TextField label="Last name" value={lastName} onChange={event=>setLastName(event.target.value)} autoComplete="family-name" required disabled={!onCreate||submitting}/>
    <TextField label="Date of birth" type="date" value={dateOfBirth} onChange={event=>setDateOfBirth(event.target.value)} required disabled={!onCreate||submitting}/>
    <div className="grid gap-1.5"><label htmlFor="child-class" className="text-sm font-semibold text-ink">Class group</label><select id="child-class" className="min-h-12 rounded-xl border border-line bg-surface px-3 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-info" value={classGroupId} onChange={event=>setClassGroupId(event.target.value)} required disabled={!onCreate||submitting||classes.length===0}><option value="">Select a class</option>{classes.filter(group=>group.active).map(group=><option key={group.id} value={group.id}>{group.name}</option>)}</select>{classes.length===0?<p className="text-xs text-ink/60">Class groups must be loaded before a child can be assigned.</p>:null}</div>
    {formError?<p role="alert" className="text-sm text-danger">{formError}</p>:null}
    {!onCreate?<p className="rounded-lg bg-canvas p-3 text-sm leading-5 text-ink/70">Child creation is unavailable until secure school services are connected.</p>:null}
    <Button type="submit" fullWidth disabled={!onCreate||classes.filter(group=>group.active).length===0||submitting} loading={submitting}>Create child record</Button>
   </form>
  </Card>
 </div>;
}
