import type { EntityId, Money, SchoolOwnedRecord } from "./common";
export type AlertSeverity = "info" | "warning" | "urgent";
export type AlertStatus = "open" | "acknowledged" | "resolved";
export type IncidentStatus = "open" | "investigating" | "resolved";
export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type PaymentMethod = "ecocash" | "cbz_transfer" | "cabs_transfer" | "card";
export type PaymentStatus = "pending" | "processing" | "succeeded" | "failed" | "cancelled" | "refunded";
export type InvoiceStatus = "draft" | "issued" | "partially_paid" | "paid" | "overdue" | "void";
export interface Alert extends SchoolOwnedRecord { title: string; message: string; severity: AlertSeverity; status: AlertStatus; recipientUserIds: EntityId[]; acknowledgedAt?: string; }
export interface Incident extends SchoolOwnedRecord { title: string; description: string; severity: IncidentSeverity; status: IncidentStatus; tripId?: EntityId; childId?: EntityId; reportedBy: EntityId; occurredAt: string; }
export interface SosEvent extends SchoolOwnedRecord { raisedBy: EntityId; tripId?: EntityId; coordinate?: { latitude: number; longitude: number }; raisedAt: string; resolvedAt?: string; }
export interface InvoiceLineItem { id: EntityId; description: string; amount: Money; }
export interface Invoice extends SchoolOwnedRecord { childId: EntityId; guardianUserId: EntityId; invoiceNumber: string; items: InvoiceLineItem[]; total: Money; balance: Money; status: InvoiceStatus; dueDate: string; }
export interface Payment extends SchoolOwnedRecord { invoiceId: EntityId; amount: Money; method: PaymentMethod; status: PaymentStatus; idempotencyKey: string; reference?: string; createdBy: EntityId; }
export interface PaymentReceipt extends SchoolOwnedRecord { paymentId: EntityId; receiptNumber: string; issuedAt: string; }
