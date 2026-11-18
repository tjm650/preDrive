export const APP_NAME = 'preDrive' as const;
export const DEFAULT_HOME_RADIUS_METRES = 1_000;
export const ARRIVAL_RADIUS_METRES = 100;
export const LOCATION_STALE_AFTER_SECONDS = 30;
export const SUPPORTED_LANGUAGES = ['en', 'sn', 'nd'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
