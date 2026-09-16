import { APP_PATHS } from "../app-paths";

/** Lien personnel complet d'un pax, à copier/partager, construit depuis l'origine courante. */
export function buildPersonalLink(
  accessToken: string,
  origin: string = window.location.origin,
): string {
  return `${origin}/${APP_PATHS.mySpace}/${accessToken}`;
}

/**
 * Certain·es collent le lien personnel complet (copié depuis un message)
 * plutôt que juste le jeton : on récupère le jeton dans les deux cas.
 */
export function extractAccessToken(input: string): string {
  const value = input.trim();
  const match = new RegExp(`/${APP_PATHS.mySpace}/([^/\\s?#]+)`).exec(value);
  return match ? match[1] : value;
}
