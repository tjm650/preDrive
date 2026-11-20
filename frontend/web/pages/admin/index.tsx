import Head from "next/head";
import {AdminShell} from "../../components/admin/AdminShell";
import {PageHeader} from "../../components/admin/PageHeader";
import {FeedbackState} from "../../components/ui/FeedbackState";
export default function AdminOverview(){return <><Head><title>School overview | preDrive</title><meta name="robots" content="noindex,nofollow"/></Head><AdminShell><PageHeader title="School overview" description="Your school's transport and safety workspace."/><FeedbackState kind="empty" title="School data is not connected" description="Live journeys, attendance and school activity will appear when the authenticated data service is connected."/></AdminShell></>;}
