import Head from "next/head";
import {useRouter} from "next/router";
import {AdminShell} from "../../components/admin/AdminShell";
import {PageHeader} from "../../components/admin/PageHeader";
import {FeedbackState} from "../../components/ui/FeedbackState";

const sections:Record<string,{title:string;description:string}> = {
 journeys:{title:"Live journeys",description:"Monitor active school transport journeys and trip status."},
 children:{title:"Children",description:"Manage child records, guardian links and transport assignments."},
 fleet:{title:"Fleet",description:"Manage school vehicles, inspections and route assignments."},
 staff:{title:"Staff",description:"Manage drivers, supervisors and school staff access."},
 safety:{title:"Safety and incidents",description:"Review incidents, emergency alerts and acknowledgements."},
 finance:{title:"Fees and payments",description:"Review invoices, payment status and finance records."},
 reports:{title:"Reports",description:"Review attendance, journey performance and school transport reporting."},
 settings:{title:"Settings",description:"Manage school profile, language and indicative currency settings."}
};

export default function AdminSectionPage(){
 const router=useRouter();
 const section=typeof router.query.section==="string"?router.query.section:"";
 const config=sections[section];
 if(!router.isReady)return <AdminShell><FeedbackState kind="loading" title="Loading workspace"/></AdminShell>;
 if(!config)return <AdminShell><PageHeader title="Page not found"/><FeedbackState kind="error" title="This workspace page does not exist"/></AdminShell>;
 return <><Head><title>{config.title} | preDrive</title><meta name="robots" content="noindex,nofollow"/></Head><AdminShell><PageHeader title={config.title} description={config.description}/><FeedbackState kind="empty" title="School data is not connected" description="This workspace will display live, school-scoped records when the authenticated data service is connected."/></AdminShell></>;
}
