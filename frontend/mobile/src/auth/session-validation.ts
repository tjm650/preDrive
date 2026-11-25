import type {UserRole} from "@predrive/shared/types";
export interface AuthenticatedSession {userId:string;schoolId:string;role:UserRole;expiresAt:string;}
export function isValidAuthenticatedSession(session:AuthenticatedSession|null,now=Date.now()):session is AuthenticatedSession {
 if(!session||!session.userId.trim()||!session.schoolId.trim())return false;
 if(!["guardian","supervisor","driver","teacher"].includes(session.role))return false;
 const expiry=Date.parse(session.expiresAt);return Number.isFinite(expiry)&&expiry>now;
}
