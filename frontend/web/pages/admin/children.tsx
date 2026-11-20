import Head from "next/head";
import {AdminShell} from "../../components/admin/AdminShell";
import {PageHeader} from "../../components/admin/PageHeader";
import {ChildrenWorkspace} from "../../components/admin/ChildrenWorkspace";
export default function AdminChildren(){return <><Head><title>Children | preDrive</title><meta name="robots" content="noindex,nofollow"/></Head><AdminShell><PageHeader title="Children" description="Manage learner records and school class assignments."/><ChildrenWorkspace children={[]} classes={[]}/></AdminShell></>;}
