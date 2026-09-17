/**
 * Segments d'URL visibles par les utilisateur·ices. Ils restent en français
 * (comme le reste de l'interface) et sont surtout stables : le lien
 * `/mon-espace/<jeton>` est partagé aux paxs par message et doit continuer
 * à fonctionner.
 */
export const APP_PATHS = {
  eventLanding: "e",
  registration: "inscription",
  mySpace: "mon-espace",
  admin: "admin",
  adminLogin: "connexion",
  adminEvents: "events",
} as const;

/** Constructeurs de chemins, pour ne jamais recomposer une URL à la main dans un composant. */
export const appLinks = {
  eventLanding: (eventId: string) => ["/", APP_PATHS.eventLanding, eventId],
  registration: (eventId: string) => ["/", APP_PATHS.eventLanding, eventId, APP_PATHS.registration],
  mySpace: (token: string) => ["/", APP_PATHS.mySpace, token],
  admin: () => ["/", APP_PATHS.admin],
  adminLogin: () => ["/", APP_PATHS.admin, APP_PATHS.adminLogin],
  adminEvent: (eventId: string) => ["/", APP_PATHS.admin, APP_PATHS.adminEvents, eventId],
};
