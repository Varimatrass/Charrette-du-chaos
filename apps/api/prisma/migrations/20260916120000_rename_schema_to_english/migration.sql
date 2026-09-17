-- Passage du schéma en anglais : tables, colonnes, enums (types ET valeurs),
-- index et contraintes. Renommage pur, aucune perte de données : les lignes
-- existantes sont conservées, seules les étiquettes changent.
--
-- Écrite à la main plutôt que générée par `prisma migrate dev`, qui aurait
-- produit des DROP + CREATE (et donc perdu les données). Les noms d'index et
-- de contraintes suivent la convention Prisma (<table>_<colonnes>_<suffixe>)
-- pour que `prisma migrate diff` ne détecte aucune dérive ensuite.

-- ---------------------------------------------------------------------------
-- Enums : on renomme les types, puis leurs valeurs (Postgres >= 10).
-- ---------------------------------------------------------------------------
ALTER TYPE "Sens" RENAME TO "Direction";
ALTER TYPE "Direction" RENAME VALUE 'ALLER' TO 'OUTBOUND';
ALTER TYPE "Direction" RENAME VALUE 'RETOUR' TO 'RETURN';

ALTER TYPE "ModeTransport" RENAME TO "TransportMode";
ALTER TYPE "TransportMode" RENAME VALUE 'COVOITURAGE' TO 'CARPOOL';
ALTER TYPE "TransportMode" RENAME VALUE 'AUTRE' TO 'OTHER';

ALTER TYPE "StatutTrajet" RENAME TO "TripStatus";
ALTER TYPE "TripStatus" RENAME VALUE 'EN_ATTENTE' TO 'PENDING';
ALTER TYPE "TripStatus" RENAME VALUE 'ASSIGNE' TO 'ASSIGNED';
ALTER TYPE "TripStatus" RENAME VALUE 'A_REVERIFIER' TO 'TO_RECHECK';

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
ALTER TABLE "events" RENAME COLUMN "nom" TO "name";
ALTER TABLE "events" RENAME COLUMN "date_debut" TO "start_date";
ALTER TABLE "events" RENAME COLUMN "date_fin" TO "end_date";
ALTER TABLE "events" RENAME COLUMN "lieu" TO "location";
ALTER TABLE "events" RENAME COLUMN "gare_reference" TO "reference_station";

-- ---------------------------------------------------------------------------
-- paxs
-- ---------------------------------------------------------------------------
ALTER TABLE "paxs" RENAME COLUMN "nom" TO "name";
ALTER TABLE "paxs" RENAME COLUMN "contact_telephone" TO "contact_phone";
ALTER TABLE "paxs" RENAME COLUMN "commentaire" TO "comment";

-- ---------------------------------------------------------------------------
-- navettes -> shuttles
-- ---------------------------------------------------------------------------
ALTER TABLE "navettes" RENAME TO "shuttles";
ALTER TABLE "shuttles" RENAME CONSTRAINT "navettes_pkey" TO "shuttles_pkey";

ALTER TABLE "shuttles" RENAME COLUMN "libelle" TO "label";
ALTER TABLE "shuttles" RENAME COLUMN "jour" TO "day";
ALTER TABLE "shuttles" RENAME COLUMN "sens" TO "direction";
ALTER TABLE "shuttles" RENAME COLUMN "conducteur" TO "driver_name";
ALTER TABLE "shuttles" RENAME COLUMN "vehicule" TO "vehicle";
ALTER TABLE "shuttles" RENAME COLUMN "heure_depart" TO "departure_time";
ALTER TABLE "shuttles" RENAME COLUMN "heure_arrivee_gare" TO "station_arrival_time";
ALTER TABLE "shuttles" RENAME COLUMN "heure_retour_lieu" TO "venue_return_time";
ALTER TABLE "shuttles" RENAME COLUMN "capacite" TO "capacity";
ALTER TABLE "shuttles" RENAME COLUMN "commentaire" TO "comment";

ALTER INDEX "navettes_event_id_idx" RENAME TO "shuttles_event_id_idx";
ALTER INDEX "navettes_driver_pax_id_idx" RENAME TO "shuttles_driver_pax_id_idx";
ALTER TABLE "shuttles" RENAME CONSTRAINT "navettes_event_id_fkey" TO "shuttles_event_id_fkey";
ALTER TABLE "shuttles" RENAME CONSTRAINT "navettes_driver_pax_id_fkey" TO "shuttles_driver_pax_id_fkey";

-- ---------------------------------------------------------------------------
-- trajets -> trips
-- ---------------------------------------------------------------------------
ALTER TABLE "trajets" RENAME TO "trips";
ALTER TABLE "trips" RENAME CONSTRAINT "trajets_pkey" TO "trips_pkey";

ALTER TABLE "trips" RENAME COLUMN "sens" TO "direction";
ALTER TABLE "trips" RENAME COLUMN "jour" TO "day";
ALTER TABLE "trips" RENAME COLUMN "heure" TO "time";
ALTER TABLE "trips" RENAME COLUMN "gare" TO "station";
ALTER TABLE "trips" RENAME COLUMN "navette_id" TO "shuttle_id";
ALTER TABLE "trips" RENAME COLUMN "statut" TO "status";
ALTER TABLE "trips" RENAME COLUMN "commentaire" TO "comment";

-- Le renommage de valeur d'enum ci-dessus est suivi par Postgres pour la
-- valeur par défaut, mais on la réaffirme explicitement pour lever tout doute.
ALTER TABLE "trips" ALTER COLUMN "status" SET DEFAULT 'PENDING';

ALTER INDEX "trajets_event_id_idx" RENAME TO "trips_event_id_idx";
ALTER INDEX "trajets_navette_id_idx" RENAME TO "trips_shuttle_id_idx";
ALTER INDEX "trajets_pax_id_sens_key" RENAME TO "trips_pax_id_direction_key";
ALTER TABLE "trips" RENAME CONSTRAINT "trajets_event_id_fkey" TO "trips_event_id_fkey";
ALTER TABLE "trips" RENAME CONSTRAINT "trajets_pax_id_fkey" TO "trips_pax_id_fkey";
ALTER TABLE "trips" RENAME CONSTRAINT "trajets_navette_id_fkey" TO "trips_shuttle_id_fkey";
