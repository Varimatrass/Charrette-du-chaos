import { IsEnum, IsOptional, IsString } from "class-validator";
import { ModeTransport } from "@desordre/shared-types";

/**
 * Corps de la requête PUT /pax/moi/trajets/:sens — le `sens` vient de l'URL,
 * pas du body. Un PUT crée le trajet s'il n'existe pas encore, ou le met à
 * jour sinon : jamais d'erreur "ça existe déjà", le pax peut toujours revenir
 * changer d'avis ou compléter plus tard (ex: ajouter le retour après coup).
 */
export class UpsertTrajetDto {
  // Facultatif : "pas encore décidé" est un état valide à l'inscription.
  @IsOptional()
  @IsEnum(ModeTransport)
  mode?: ModeTransport;

  @IsOptional()
  @IsString()
  jour?: string;

  @IsOptional()
  @IsString()
  heure?: string;

  @IsOptional()
  @IsString()
  gare?: string;

  @IsOptional()
  @IsString()
  commentaire?: string;
}
