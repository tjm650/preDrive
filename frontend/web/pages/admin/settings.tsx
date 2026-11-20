import Head from "next/head";
import {AdminShell} from "../../components/admin/AdminShell";
import {PageHeader} from "../../components/admin/PageHeader";
import {SchoolSettingsWorkspace} from "../../components/admin/SchoolSettingsWorkspace";
export default function AdminSettings(){return <><Head><title>School settings | preDrive</title><meta name="robots" content="noindex,nofollow"/></Head><AdminShell><PageHeader title="School settings" description="Manage your school's profile and currency display settings."/><SchoolSettingsWorkspace school={null}/></AdminShell></>;}
