import type {ApiResult,PageRequest,PageResult} from "./types";
import type {SignInInput,PasswordResetInput,CreateChildInput,StartTripInput,ChildStatusInput,VerifyHandoverInput,InitiatePaymentInput,CreateIncidentInput} from "./inputs";
import type {UserProfile,School,SchoolMembership,Child,StaffMember,Bus,TransportRoute,Trip,Alert,Incident,Invoice,Payment,PaymentReceipt,ApprovedCollector} from "../../types";
export interface AuthSession {user:UserProfile;memberships:SchoolMembership[];activeSchool:School|null;expiresAt:string;}
export interface PreDriveApi {
 auth:{
  signIn(input:SignInInput):Promise<ApiResult<AuthSession>>;
  signOut():Promise<ApiResult<void>>;
  getSession():Promise<ApiResult<AuthSession|null>>;
  requestPasswordReset(input:PasswordResetInput):Promise<ApiResult<void>>;
  switchSchool(schoolId:string):Promise<ApiResult<AuthSession>>;
 };
 school:{getCurrent():Promise<ApiResult<School>>;update(input:Partial<School>):Promise<ApiResult<School>>;};
 children:{
  list(request:PageRequest):Promise<ApiResult<PageResult<Child>>>;
  get(childId:string):Promise<ApiResult<Child>>;
  create(input:CreateChildInput):Promise<ApiResult<Child>>;
  update(childId:string,input:Partial<CreateChildInput>):Promise<ApiResult<Child>>;
 };
 staff:{list(request:PageRequest):Promise<ApiResult<PageResult<StaffMember>>>;};
 transport:{
  listBuses(request:PageRequest):Promise<ApiResult<PageResult<Bus>>>;
  listRoutes(request:PageRequest):Promise<ApiResult<PageResult<TransportRoute>>>;
  listTrips(request:PageRequest):Promise<ApiResult<PageResult<Trip>>>;
  startTrip(input:StartTripInput):Promise<ApiResult<Trip>>;
  recordChildStatus(input:ChildStatusInput):Promise<ApiResult<void>>;
  verifyHandover(input:VerifyHandoverInput):Promise<ApiResult<void>>;
  listApprovedCollectors(childId:string):Promise<ApiResult<ApprovedCollector[]>>;
 };
 safety:{
  listAlerts(request:PageRequest):Promise<ApiResult<PageResult<Alert>>>;
  listIncidents(request:PageRequest):Promise<ApiResult<PageResult<Incident>>>;
  createIncident(input:CreateIncidentInput):Promise<ApiResult<Incident>>;
  raiseSos(input:{tripId?:string;latitude?:number;longitude?:number}):Promise<ApiResult<void>>;
 };
 finance:{
  listInvoices(request:PageRequest):Promise<ApiResult<PageResult<Invoice>>>;
  initiatePayment(input:InitiatePaymentInput):Promise<ApiResult<Payment>>;
  getReceipt(paymentId:string):Promise<ApiResult<PaymentReceipt>>;
 };
}
