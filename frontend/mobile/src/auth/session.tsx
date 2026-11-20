import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from "react";
import type {UserRole} from "@predrive/shared/types";
import {isValidAuthenticatedSession,type AuthenticatedSession} from "./session-validation";
export type AuthSessionStatus="checking"|"unavailable"|"signed_out"|"signed_in";
export interface AuthSessionSource {getSnapshot():Promise<AuthenticatedSession|null>;subscribe(listener:(session:AuthenticatedSession|null)=>void):()=>void;}
interface Value {status:AuthSessionStatus;session:AuthenticatedSession|null;role:UserRole|null;}
const Context=createContext<Value>({status:"unavailable",session:null,role:null});
export function AuthSessionProvider({children,source}:{children:ReactNode;source?:AuthSessionSource}){
 const [status,setStatus]=useState<AuthSessionStatus>(source?"checking":"unavailable");
 const [session,setSession]=useState<AuthenticatedSession|null>(null);
 useEffect(()=>{
  if(!source){setStatus("unavailable");setSession(null);return;}
  let mounted=true;
  const apply=(candidate:AuthenticatedSession|null)=>{if(!mounted)return;if(isValidAuthenticatedSession(candidate)){setSession(candidate);setStatus("signed_in");}else{setSession(null);setStatus("signed_out");}};
  const unsubscribe=source.subscribe(apply);
  void source.getSnapshot().then(apply).catch(()=>{if(mounted){setSession(null);setStatus("signed_out");}});
  return()=>{mounted=false;unsubscribe();};
 },[source]);
 const value=useMemo(()=>({status,session,role:session?.role??null}),[status,session]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAuthSession(){return useContext(Context);}
