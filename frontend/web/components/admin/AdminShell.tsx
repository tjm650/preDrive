import {useEffect,useState,type ReactNode} from "react";
import {AdminSidebar} from "./AdminSidebar";
import {AdminTopbar} from "./AdminTopbar";
export function AdminShell({children,schoolName,userName,roleLabel,onSignOut}:{children:ReactNode;schoolName?:string;userName?:string;roleLabel?:string;onSignOut?:()=>void}){
 const [open,setOpen]=useState(false);
 useEffect(()=>{if(!open)return;const previous=document.body.style.overflow;document.body.style.overflow="hidden";const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false);};window.addEventListener("keydown",close);return()=>{document.body.style.overflow=previous;window.removeEventListener("keydown",close);};},[open]);
 return <div className="min-h-screen bg-canvas text-ink"><AdminSidebar schoolName={schoolName} open={open} onClose={()=>setOpen(false)}/><div className="min-h-screen lg:pl-[264px]"><AdminTopbar userName={userName} roleLabel={roleLabel} onMenu={()=>setOpen(true)} onSignOut={onSignOut}/><main className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-8 md:py-8">{children}</main></div></div>;
}
