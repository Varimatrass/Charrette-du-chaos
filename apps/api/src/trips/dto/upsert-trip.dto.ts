import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { CarpoolRole, TransportMode } from "@desordre/shared-types";
import type { UpsertTripInput } from "@desordre/shared-types";

/**
 * Corps de la requête PUT /pax/me/trips/:direction — la direction vient de
 * l'URL, pas du body. Un PUT crée le trajet s'il n'existe pas encore, ou le
 * met à jour sinon : jamais d'erreur "ça existe déjà", le pax peut toujours
 * revenir changer d'avis ou compléter plus tard (ex: ajouter le retour).
 *
 * Les champs propres à un mode (gare pour le train, covoiturage pour le
 * covoit) sont ignorés/remis à zéro si le mode ne correspond pas.
 */
export class UpsertTripDto implements UpsertTripInput {
  // Facultatif : "pas encore décidé" est un état valide à l'inscription.
  @IsOptional()
  @IsIn(Object.values(TransportMode))
  mode?: TransportMode;

  @IsOptional()
  @IsString()
  day?: string;

  @IsOptional()
  @IsString()
  time?: string;

  /** Gare existante de l'évènement. */
  @IsOptional()
  @IsUUID()
  stationId?: string;

  /** Nouvelle gare, créée à la volée si elle n'existe pas encore (prioritaire sur stationId). */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  stationName?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  /** Covoiturage : d'où le pax part (aller) / où iel rentre (retour). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  origin?: string;

  @IsOptional()
  @IsIn(Object.values(CarpoolRole))
  carpoolRole?: CarpoolRole;

  /** Voiture où le pax a une place (PASSENGER uniquement ; DRIVER = sa propre voiture). */
  @IsOptional()
  @IsUUID()
  carId?: string;

  @IsOptional()
  @IsBoolean()
  lookingForCarpool?: boolean;
}
