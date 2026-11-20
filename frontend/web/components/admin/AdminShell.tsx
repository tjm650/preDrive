import {useEffect,useRef,useState,type ReactNode} from "react";
import {AdminSidebar} from "./AdminSidebar";
import {AdminTopbar} from "./AdminTopbar";

export function AdminShell({children,schoolName,userName,roleLabel,onSignOut}:{children:ReactNode;schoolName?:string;userName?:string;roleLabel?:string;onSignOut?:()=>void}){
 const [open,setOpen]=useState(false);
 const menuButtonRef=useRef<HTMLButtonElement>(null);

 useEffect(()=>{
  if(!open)return;
  const previouslyFocused=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const drawer=document.querySelector<HTMLElement>("[data-admin-mobile-sidebar]");
  const getFocusable=()=>drawer?Array.from(drawer.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(element=>element.offsetParent!==null):[];
  getFocusable()[0]?.focus();

  const handleKeyDown=(event:KeyboardEvent)=>{
   if(event.key==="Escape"){
    event.preventDefault();
    setOpen(false);
    return;
   }
   if(event.key!=="Tab")return;
   const focusable=getFocusable();
   if(focusable.length===0){event.preventDefault();return;}
   const first=focusable[0],last=focusable[focusable.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  };
  window.addEventListener("keydown",handleKeyDown);
  return()=>{
   window.removeEventListener("keydown",handleKeyDown);
   const target=previouslyFocused?.isConnected?previouslyFocused:menuButtonRef.current;
   target?.focus();
  };
 },[open]);

 return <div className="min-h-screen bg-canvas text-ink">
  <AdminSidebar schoolName={schoolName} open={open} onClose={()=>setOpen(false)}/>
  <div className="min-h-screen lg:pl-[264px]">
   <AdminTopbar userName={userName} roleLabel={roleLabel} menuButtonRef={menuButtonRef} onMenu={()=>setOpen(true)} onSignOut={onSignOut}/>
   <main className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-8 md:py-8">{children}</main>
  </div>
 </div>;
}
