export type EntityId = string;
export type IsoDateTime = string;
export type DateOnly = string;
export type PhoneNumber = string;
export type EmailAddress = string;
export type LanguageCode = "en" | "sn" | "nd";
export type CurrencyCode = "USD" | "ZiG";
export type RecordStatus = "active" | "inactive" | "archived";
export interface TimestampedRecord { id: EntityId; createdAt: IsoDateTime; updatedAt: IsoDateTime; }
export interface SchoolOwnedRecord extends TimestampedRecord { schoolId: EntityId; }
export interface Money { amount: number; currency: CurrencyCode; }
export interface IndicativeMoney { usd: number; zig: number; exchangeRate: number; rateLabel: "indicative rate"; }
export interface GeoCoordinate { latitude: number; longitude: number; }
export interface PostalAddress { line1: string; suburb: string; city: string; province?: string; country: "Zimbabwe"; }
export interface ContactDetails { name: string; phone: PhoneNumber; email?: EmailAddress; }
