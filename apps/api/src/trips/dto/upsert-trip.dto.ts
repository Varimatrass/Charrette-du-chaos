import { IsIn, IsOptional, IsString } from "class-validator";
import { TransportMode } from "@desordre/shared-types";
import type { UpsertTripInput } from "@desordre/shared-types";

/**
 * Corps de la requête PUT /pax/me/trips/:direction — la direction vient de
 * l'URL, pas du body. Un PUT crée le trajet s'il n'existe pas encore, ou le
 * met à jour sinon : jamais d'erreur "ça existe déjà", le pax peut toujours
 * revenir changer d'avis ou compléter plus tard (ex: ajouter le retour).
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

  @IsOptional()
  @IsString()
  station?: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
