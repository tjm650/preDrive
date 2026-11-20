import Head from "next/head";
import Link from "next/link";
import {Button} from "../components/ui/Button";
export default function ForbiddenPage(){return <><Head><title>Access restricted | preDrive</title></Head><main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-5 text-center"><h1 className="font-display text-3xl font-extrabold text-ink">Access restricted</h1><p className="max-w-md text-base leading-6 text-ink/70">Your account does not have permission to access this area.</p><Link href="/signin"><Button>Return to sign in</Button></Link></main></>;}
