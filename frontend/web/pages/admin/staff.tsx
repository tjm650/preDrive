import Head from "next/head";
import {AdminShell} from "../../components/admin/AdminShell";
import {PageHeader} from "../../components/admin/PageHeader";
import {StaffWorkspace} from "../../components/admin/StaffWorkspace";
export default function AdminStaff(){return <><Head><title>Staff | preDrive</title><meta name="robots" content="noindex,nofollow"/></Head><AdminShell><PageHeader title="Staff" description="Manage school staff access and role-specific invitations."/><StaffWorkspace staff={[]} invitations={[]}/></AdminShell></>;}
