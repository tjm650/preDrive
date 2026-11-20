import {useEffect,type ReactNode} from "react";
import {useRouter} from "expo-router";
import type {UserRole} from "@predrive/shared/types";
import {FeedbackState} from "../../components/ui/feedback-state";
import {useAuthSession} from "./session";
export function RoleAccessGate({requiredRole,children}:{requiredRole:UserRole;children:ReactNode}){
 const router=useRouter();const {status,role}=useAuthSession();
 useEffect(()=>{if(status==="unavailable"||status==="signed_out"){router.replace("/signin");return;}if(status==="signed_in"&&role!==requiredRole)router.replace("/access-denied");},[status,role,requiredRole,router]);
 if(status==="checking")return <FeedbackState loading title="Checking your secure session"/>;
 if(status!=="signed_in"||role!==requiredRole)return null;
 return children;
}
