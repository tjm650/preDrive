import type {UserRole} from "../../types/identity";
export type Permission="school:manage"|"children:read"|"children:manage"|"trips:read"|"trips:manage"|"handover:verify"|"vehicle:check"|"safety:report"|"finance:read"|"finance:manage"|"staff:manage"|"reports:read";
const permissions:Record<UserRole,readonly Permission[]>={
 school_admin:["school:manage","children:read","children:manage","trips:read","trips:manage","handover:verify","vehicle:check","safety:report","finance:read","finance:manage","staff:manage","reports:read"],
 guardian:["children:read","trips:read","finance:read"],
 supervisor:["children:read","trips:read","trips:manage","handover:verify","safety:report"],
 driver:["trips:read","vehicle:check","safety:report"],
 teacher:["children:read","trips:read","safety:report"]
};
export function hasPermission(role:UserRole,permission:Permission):boolean{return permissions[role].includes(permission);}
export function getRolePermissions(role:UserRole):readonly Permission[]{return permissions[role];}
export function canAccessRole(role:UserRole,allowed:readonly UserRole[]):boolean{return allowed.includes(role);}
