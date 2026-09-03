-- Renomme le concept "édition" en "évènement" (Event) dans le schéma :
-- renommage pur (table, colonnes, index, contraintes), aucune perte de
-- données. Écrite à la main plutôt que générée par `prisma migrate dev`
-- pour éviter un DROP TABLE + CREATE TABLE (Prisma ne détecte pas
-- toujours un renommage automatiquement).

-- Table
ALTER TABLE "editions" RENAME TO "events";
ALTER TABLE "events" RENAME CONSTRAINT "editions_pkey" TO "events_pkey";

-- Colonnes edition_id -> event_id
ALTER TABLE "paxs" RENAME COLUMN "edition_id" TO "event_id";
ALTER TABLE "navettes" RENAME COLUMN "edition_id" TO "event_id";
ALTER TABLE "trajets" RENAME COLUMN "edition_id" TO "event_id";

-- Index
ALTER INDEX "paxs_edition_id_idx" RENAME TO "paxs_event_id_idx";
ALTER INDEX "navettes_edition_id_idx" RENAME TO "navettes_event_id_idx";
ALTER INDEX "trajets_edition_id_idx" RENAME TO "trajets_event_id_idx";

-- Contraintes de clé étrangère
ALTER TABLE "paxs" RENAME CONSTRAINT "paxs_edition_id_fkey" TO "paxs_event_id_fkey";
ALTER TABLE "navettes" RENAME CONSTRAINT "navettes_edition_id_fkey" TO "navettes_event_id_fkey";
ALTER TABLE "trajets" RENAME CONSTRAINT "trajets_edition_id_fkey" TO "trajets_event_id_fkey";
