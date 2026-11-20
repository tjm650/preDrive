import Link from "next/link";
import {useRouter} from "next/router";
import {Activity,Bus,ChartNoAxesCombined,ClipboardList,FileText,LayoutDashboard,MapPinned,ShieldAlert,Users,Settings} from "lucide-react";
const items=[{href:"/admin",label:"Overview",icon:LayoutDashboard},{href:"/admin/journeys",label:"Live journeys",icon:MapPinned},{href:"/admin/children",label:"Children",icon:Users},{href:"/admin/fleet",label:"Fleet",icon:Bus},{href:"/admin/staff",label:"Staff",icon:ClipboardList},{href:"/admin/safety",label:"Safety and incidents",icon:ShieldAlert},{href:"/admin/finance",label:"Fees and payments",icon:FileText},{href:"/admin/reports",label:"Reports",icon:ChartNoAxesCombined},{href:"/admin/settings",label:"Settings",icon:Settings}];
export function AdminNavigation({onNavigate}:{onNavigate?:()=>void}){
 const router=useRouter();return <nav aria-label="Main navigation" className="grid gap-1">{items.map(item=>{const active=router.pathname===item.href||(item.href!=="/admin"&&router.pathname.startsWith(item.href));const Icon=item.icon;return <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active?"page":undefined} className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors ${active?"bg-ink text-white":"text-ink hover:bg-[#EDEAE2]"}`}><Icon size={18} strokeWidth={1.8}/><span>{item.label}</span></Link>;})}</nav>;
}
