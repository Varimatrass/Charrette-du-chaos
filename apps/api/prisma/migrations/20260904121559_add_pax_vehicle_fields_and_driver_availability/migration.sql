-- Parcours d'inscription pax v2 : bloc véhicule/conduite sur Pax (discord,
-- possession d'un véhicule et modalités de prêt, permis, volonté de
-- conduire des navettes) + nouvelle table de créneaux de disponibilité
-- conducteur·ice. Purement additif, aucune perte de données : toutes les
-- nouvelles colonnes sont nullables (une ligne existante = "pas encore
-- répondu", jamais "non" par défaut).

-- Enum de nuance du prêt de véhicule (question d'assurance : prêter son
-- véhicule seulement si c'est soi-même qui conduit, ou même à quelqu'un d'autre).
CREATE TYPE "VehicleLendingMode" AS ENUM ('NOT_AVAILABLE', 'ONLY_IF_OWNER_DRIVES', 'AVAILABLE_ANY_DRIVER');

-- Nouvelles colonnes sur paxs
ALTER TABLE "paxs" ADD COLUMN "discord_handle" TEXT;
ALTER TABLE "paxs" ADD COLUMN "has_vehicle" BOOLEAN;
ALTER TABLE "paxs" ADD COLUMN "vehicle_lending_mode" "VehicleLendingMode";
ALTER TABLE "paxs" ADD COLUMN "has_driving_license" BOOLEAN;
ALTER TABLE "paxs" ADD COLUMN "willing_to_drive_shuttle" BOOLEAN;

-- Le mode de transport d'un trajet devient facultatif : à l'inscription,
-- il peut être "pas encore décidé" et précisé plus tard par le pax.
ALTER TABLE "trajets" ALTER COLUMN "mode" DROP NOT NULL;

-- Créneaux de disponibilité conducteur·ice
CREATE TABLE "driver_availability_slots" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "pax_id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "start_time" TEXT,
    "end_time" TEXT,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_availability_slots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "driver_availability_slots_event_id_idx" ON "driver_availability_slots"("event_id");
CREATE INDEX "driver_availability_slots_pax_id_idx" ON "driver_availability_slots"("pax_id");

ALTER TABLE "driver_availability_slots" ADD CONSTRAINT "driver_availability_slots_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "driver_availability_slots" ADD CONSTRAINT "driver_availability_slots_pax_id_fkey" FOREIGN KEY ("pax_id") REFERENCES "paxs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
