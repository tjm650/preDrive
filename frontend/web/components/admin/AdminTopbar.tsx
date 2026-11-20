import {Menu,LogOut} from "lucide-react";
import type {Ref} from "react";

export function AdminTopbar({userName="Account",roleLabel="School administrator",onMenu,onSignOut,menuButtonRef}:{userName?:string;roleLabel?:string;onMenu?:()=>void;onSignOut?:()=>void;menuButtonRef?:Ref<HTMLButtonElement>}){
 return <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-canvas/95 px-4 backdrop-blur-sm md:px-8">
  <button ref={menuButtonRef} type="button" onClick={onMenu} aria-label="Open navigation" aria-expanded={undefined} className="flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info lg:hidden"><Menu size={21}/></button>
  <div className="ml-auto flex items-center gap-3">
   <div className="hidden text-right sm:block"><p className="text-sm font-bold text-ink">{userName}</p><p className="text-xs text-ink/65">{roleLabel}</p></div>
   <button type="button" onClick={onSignOut} aria-label="Sign out" disabled={!onSignOut} className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-ink hover:bg-[#EDEAE2] disabled:cursor-not-allowed disabled:opacity-50"><LogOut size={18}/></button>
  </div>
 </header>;
}
