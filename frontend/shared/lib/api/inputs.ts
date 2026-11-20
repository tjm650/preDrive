import type {EntityId,Money} from "../../types/common";
import type {PaymentMethod,IncidentSeverity} from "../../types/safety-finance";
export interface SignInInput{email:string;password:string;}
export interface PasswordResetInput{email:string;}
export interface CreateChildInput{firstName:string;lastName:string;dateOfBirth:string;classGroupId:EntityId;}
export interface StartTripInput{tripId:EntityId;startedAt:string;}
export interface ChildStatusInput{tripId:EntityId;childId:EntityId;recordedAt:string;idempotencyKey:string;}
export interface VerifyHandoverInput{tripId:EntityId;childId:EntityId;collectorId:EntityId;pin:string;}
export interface InitiatePaymentInput{invoiceId:EntityId;amount:Money;method:PaymentMethod;idempotencyKey:string;}
export interface CreateIncidentInput{title:string;description:string;severity:IncidentSeverity;tripId?:EntityId;childId?:EntityId;}
