import Head from "next/head";
import {AdminShell} from "../../components/admin/AdminShell";
import {PageHeader} from "../../components/admin/PageHeader";
import {FleetWorkspace} from "../../components/admin/FleetWorkspace";
export default function AdminFleet(){return <><Head><title>Fleet and routes | preDrive</title><meta name="robots" content="noindex,nofollow"/></Head><AdminShell><PageHeader title="Fleet and routes" description="Register school vehicles and maintain ordered transport routes."/><FleetWorkspace buses={[]} routes={[]}/></AdminShell></>;}
