export type AppEnvironment="development"|"staging"|"production";
export interface PublicEnvironment {environment:AppEnvironment;supabaseUrl?:string;supabasePublishableKey?:string;}
export function createApplicationEnvironment(input:{environment?:string;supabaseUrl?:string;supabasePublishableKey?:string}):PublicEnvironment{
 const environment=(input.environment??"development") as AppEnvironment;
 if(!["development","staging","production"].includes(environment))throw new Error("Invalid application environment.");
 if(input.supabaseUrl){const url=new URL(input.supabaseUrl);if(environment!=="development"&&url.protocol!=="https:")throw new Error("Supabase URL must use HTTPS outside development.");}
 if(input.supabasePublishableKey&&!input.supabasePublishableKey.startsWith("sb_publishable_"))throw new Error("Only a Supabase publishable key may be used in the client.");
 return {environment,supabaseUrl:input.supabaseUrl,supabasePublishableKey:input.supabasePublishableKey};
}
