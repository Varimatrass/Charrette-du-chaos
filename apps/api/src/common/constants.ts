/** En-tête HTTP portant la clé partagée du back-office organisateur·ice. */
export const ADMIN_KEY_HEADER = "x-admin-key";

/** En-tête HTTP portant le jeton d'accès personnel d'un pax. */
export const PAX_TOKEN_HEADER = "x-pax-token";

/** Variables d'environnement lues par l'API, centralisées pour éviter les fautes de frappe. */
export const ENV = {
  DATABASE_URL: "DATABASE_URL",
  ADMIN_KEY: "ADMIN_KEY",
  FRONTEND_URL: "FRONTEND_URL",
  CORS_ORIGINS: "CORS_ORIGINS",
  PORT: "PORT",
} as const;

export const DEFAULT_FRONTEND_URL = "http://localhost:4200";
export const DEFAULT_PORT = 3000;
