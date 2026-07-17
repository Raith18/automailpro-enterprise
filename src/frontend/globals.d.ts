/**
 * Frontend global declarations.
 * Prevents IDE from complaining about the globally injected Google Apps Script 'google' object.
 */

declare global {
  const google: any;
}

export {};
