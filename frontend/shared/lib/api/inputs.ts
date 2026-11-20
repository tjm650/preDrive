import type {EntityId,Money} from "../../types/common";
import type {PaymentMethod,IncidentSeverity} from "../../types/safety-finance";
import type {BusStatus,RouteStatus} from "../../types/transport";
export interface SignInInput{email:string;password:string;}
export interface PasswordResetInput{email:string;}
export interface CreateChildInput{firstName:string;lastName:string;dateOfBirth:string;classGroupId:EntityId;}
export interface CreateBusInput{registrationNumber:string;make:string;model:string;capacity:number;}
export interface CreateRouteStopInput{name:string;address:string;order:number;}
export interface CreateTransportRouteInput{name:string;code:string;stops:CreateRouteStopInput[];busId?:EntityId;}
export interface UpdateBusInput extends Partial<CreateBusInput>{status?:BusStatus;}
export interface UpdateTransportRouteInput extends Partial<Omit<CreateTransportRouteInput,"stops">>{status?:RouteStatus;stops?:CreateRouteStopInput[];}
export interface StartTripInput{tripId:EntityId;startedAt:string;}
export interface ChildStatusInput{tripId:EntityId;childId:EntityId;recordedAt:string;idempotencyKey:string;}
export interface VerifyHandoverInput{tripId:EntityId;childId:EntityId;collectorId:EntityId;pin:string;}
export interface InitiatePaymentInput{invoiceId:EntityId;amount:Money;method:PaymentMethod;idempotencyKey:string;}
export interface CreateIncidentInput{title:string;description:string;severity:IncidentSeverity;tripId?:EntityId;childId?:EntityId;}
