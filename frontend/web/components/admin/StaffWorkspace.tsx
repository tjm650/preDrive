import {useMemo,useState,type FormEvent} from "react";
import type {SchoolInvitation,StaffMember,UserRole} from "@predrive/shared/types";
import {Button} from "../ui/Button";
import {Card} from "../ui/Card";
import {TextField} from "../ui/TextField";

interface Props {
 staff:StaffMember[];
 invitations:SchoolInvitation[];
 loading?:boolean;
 error?:string;
 onRetry?:()=>void;
 onInvite?:(input:{email:string;role:Extract<UserRole,"teacher"|"supervisor"|"driver">})=>Promise<void>;
}
const roles:{value:Extract<UserRole,"teacher"|"supervisor"|"driver">;label:string;description:string}[]=[
 {value:"teacher",label:"Teacher",description:"Classroom and learner attendance responsibilities"},
 {value:"supervisor",label:"Supervisor",description:"Trip operations, child accountability and handovers"},
 {value:"driver",label:"Driver",description:"Vehicle checks, assigned routes and driving safety"}
];
export function StaffWorkspace({staff,invitations,loading=false,error,onRetry,onInvite}:Props){
 const [email,setEmail]=useState("");const [role,setRole]=useState<Extract<UserRole,"teacher"|"supervisor"|"driver">>("teacher");const [submitting,setSubmitting]=useState(false);const [formError,setFormError]=useState("");
 const pending=invitations.filter(invite=>invite.status==="pending");
 const visibleStaff=useMemo(()=>staff.filter(member=>member.active),[staff]);
 const submit=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();setFormError("");if(!onInvite||!email.trim()){setFormError("Enter a valid staff email address.");return;}setSubmitting(true);try{await onInvite({email:email.trim().toLowerCase(),role});setEmail("");}catch{setFormError("The invitation could not be sent. No invitation has been recorded.");}finally{setSubmitting(false);}};
 return <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
  <div className="grid content-start gap-6">
   <Card className="p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-ink">School staff</h2><p className="mt-1 text-sm text-ink/65">Active teachers, supervisors and drivers.</p></div><span className="text-sm font-semibold text-ink/65">{visibleStaff.length} active</span></div>
   {loading?<div className="mt-5 rounded-xl bg-canvas p-8 text-center text-sm text-ink/65" aria-live="polite">Loading staff records…</div>:error?<div className="mt-5 rounded-xl border border-danger/30 p-5" role="alert"><p className="font-semibold">Staff records unavailable</p><p className="mt-1 text-sm text-ink/70">{error}</p>{onRetry?<Button className="mt-4" variant="outline" onClick={onRetry}>Try again</Button>:null}</div>:visibleStaff.length===0?<div className="mt-5 rounded-xl border border-dashed border-line bg-canvas/60 px-5 py-10 text-center"><h3 className="font-bold">No staff records loaded</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink/65">Your school's active staff list will appear after the authenticated staff service is connected.</p></div>:<div className="mt-4 divide-y divide-line">{visibleStaff.map(member=><div key={member.id} className="flex flex-col justify-between gap-2 py-4 sm:flex-row sm:items-center"><div><p className="font-semibold">{member.fullName}</p><p className="mt-1 text-sm text-ink/65">{member.phone}</p></div><span className="w-fit rounded-full bg-canvas px-3 py-1 text-xs font-semibold capitalize">{member.role}</span></div>)}</div>}</Card>
   <Card className="p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Pending invitations</h2><p className="mt-1 text-sm text-ink/65">Invitations awaiting acceptance or expiry.</p></div><span className="text-sm font-semibold text-ink/65">{pending.length} pending</span></div>{pending.length===0?<p className="mt-5 rounded-xl bg-canvas px-4 py-6 text-center text-sm text-ink/65">No pending invitations are available.</p>:<div className="mt-4 divide-y divide-line">{pending.map(invite=><div key={invite.id} className="flex flex-col justify-between gap-1 py-3 sm:flex-row sm:items-center"><span className="font-medium">{invite.email}</span><span className="text-sm capitalize text-ink/65">{invite.role} · Expires {new Date(invite.expiresAt).toLocaleDateString()}</span></div>)}</div>}</Card>
  </div>
  <Card className="h-fit p-5"><h2 className="text-lg font-bold">Invite staff member</h2><p className="mt-1 text-sm leading-6 text-ink/65">Send a role-specific invitation to join this school.</p><form onSubmit={submit} className="mt-5 grid gap-4"><TextField label="Staff email" type="email" value={email} onChange={event=>setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" required disabled={!onInvite||submitting}/><fieldset disabled={!onInvite||submitting} className="grid gap-2"><legend className="mb-2 text-sm font-semibold">Choose a role</legend>{roles.map(option=><label key={option.value} className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors ${role===option.value?"border-ink bg-canvas":"border-line"}`}><input type="radio" name="staff-role" value={option.value} checked={role===option.value} onChange={()=>setRole(option.value)} className="mt-1 accent-[#0F2A43]"/><span><span className="block text-sm font-bold">{option.label}</span><span className="mt-1 block text-xs leading-5 text-ink/65">{option.description}</span></span></label>)}</fieldset>{formError?<p role="alert" className="text-sm text-danger">{formError}</p>:null}{!onInvite?<p className="rounded-lg bg-canvas p-3 text-sm leading-5 text-ink/70">Staff invitations are unavailable until secure school services are connected. Invitation links must be single-use and expire.</p>:null}<Button type="submit" fullWidth disabled={!onInvite||submitting} loading={submitting}>Send staff invitation</Button></form></Card>
 </div>;
}
