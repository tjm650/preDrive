import {AdminNavigation} from "./AdminNavigation";

export function AdminSidebar({schoolName="School workspace",open=false,onClose}:{schoolName?:string;open?:boolean;onClose?:()=>void}){
 return <>
  <button type="button" aria-label="Close navigation" onClick={onClose} tabIndex={open?0:-1} aria-hidden={!open} className={`fixed inset-0 z-40 bg-ink/35 lg:hidden ${open?"block":"hidden"}`}/>
  <aside data-admin-mobile-sidebar role={open?"dialog":undefined} aria-modal={open?true:undefined} aria-label="School navigation" className={`fixed inset-y-0 left-0 z-50 w-[264px] border-r border-line bg-surface px-5 py-6 transition-transform duration-200 motion-reduce:transition-none lg:translate-x-0 ${open?"translate-x-0":"-translate-x-full"}`}>
   <div className="mb-8 border-b border-line pb-5"><p className="text-xl font-extrabold tracking-tight text-ink">preDrive</p><p className="mt-1 truncate text-sm text-ink/65">{schoolName}</p></div>
   <AdminNavigation onNavigate={onClose}/>
  </aside>
 </>;
}
