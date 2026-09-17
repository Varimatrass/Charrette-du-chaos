-- Covoiturage, gares et configuration d'évènement.
--
-- Écrite à la main : elle crée les nouvelles tables (stations, cars), ajoute
-- les nouvelles colonnes, puis MIGRE les données existantes avant de
-- supprimer les anciennes colonnes :
--   - events.reference_station  -> une ligne dans stations + preferred_station_id
--   - trips.station (texte)     -> stations (une par nom et par évènement) + station_id
--   - paxs.vehicle_lending_mode -> cars (une voiture par pax ayant déclaré en avoir une)
--   - shuttles.driver_name      -> reporté dans le commentaire si aucun pax n'est lié
-- Les noms d'index/contraintes suivent la convention Prisma.

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------
CREATE TYPE "CarpoolRole" AS ENUM ('DRIVER', 'PASSENGER');

-- ---------------------------------------------------------------------------
-- stations
-- ---------------------------------------------------------------------------
CREATE TABLE "stations" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stations_event_id_name_key" ON "stations"("event_id", "name");
CREATE INDEX "stations_event_id_idx" ON "stations"("event_id");

ALTER TABLE "stations" ADD CONSTRAINT "stations_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- events : ouverture aux paxs + gare préférée
-- ---------------------------------------------------------------------------
ALTER TABLE "events" ADD COLUMN "open_to_paxs" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "events" ADD COLUMN "preferred_station_id" TEXT;

ALTER TABLE "events" ADD CONSTRAINT "events_preferred_station_id_fkey"
  FOREIGN KEY ("preferred_station_id") REFERENCES "stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- La gare de référence de chaque évènement devient sa gare préférée.
INSERT INTO "stations" ("id", "event_id", "name", "updated_at")
SELECT gen_random_uuid()::text, "id", "reference_station", CURRENT_TIMESTAMP
FROM "events"
WHERE "reference_station" IS NOT NULL AND btrim("reference_station") <> '';

UPDATE "events" e
SET "preferred_station_id" = s."id"
FROM "stations" s
WHERE s."event_id" = e."id" AND s."name" = e."reference_station";

ALTER TABLE "events" DROP COLUMN "reference_station";

-- ---------------------------------------------------------------------------
-- cars
-- ---------------------------------------------------------------------------
CREATE TABLE "cars" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "owner_pax_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seats" INTEGER NOT NULL,
    "lending_mode" "VehicleLendingMode" NOT NULL DEFAULT 'NOT_AVAILABLE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cars_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cars_owner_pax_id_key" ON "cars"("owner_pax_id");
CREATE INDEX "cars_event_id_idx" ON "cars"("event_id");

ALTER TABLE "cars" ADD CONSTRAINT "cars_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cars" ADD CONSTRAINT "cars_owner_pax_id_fkey"
  FOREIGN KEY ("owner_pax_id") REFERENCES "paxs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Un pax qui avait déclaré une voiture en reçoit une, à compléter (nom
-- générique, 4 places par défaut), avec sa nuance de prêt d'origine.
INSERT INTO "cars" ("id", "event_id", "owner_pax_id", "name", "seats", "lending_mode", "updated_at")
SELECT gen_random_uuid()::text, "event_id", "id", 'Voiture de ' || "name", 4,
       COALESCE("vehicle_lending_mode", 'NOT_AVAILABLE'), CURRENT_TIMESTAMP
FROM "paxs"
WHERE "has_vehicle" = true;

ALTER TABLE "paxs" DROP COLUMN "vehicle_lending_mode";

-- ---------------------------------------------------------------------------
-- trips : gare liée, covoiturage
-- ---------------------------------------------------------------------------
ALTER TABLE "trips" ADD COLUMN "station_id" TEXT;
ALTER TABLE "trips" ADD COLUMN "origin" TEXT;
ALTER TABLE "trips" ADD COLUMN "carpool_role" "CarpoolRole";
ALTER TABLE "trips" ADD COLUMN "car_id" TEXT;
ALTER TABLE "trips" ADD COLUMN "looking_for_carpool" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "trips_station_id_idx" ON "trips"("station_id");
CREATE INDEX "trips_car_id_idx" ON "trips"("car_id");

ALTER TABLE "trips" ADD CONSTRAINT "trips_station_id_fkey"
  FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "trips" ADD CONSTRAINT "trips_car_id_fkey"
  FOREIGN KEY ("car_id") REFERENCES "cars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Les gares tapées en texte libre deviennent des gares de l'évènement.
INSERT INTO "stations" ("id", "event_id", "name", "updated_at")
SELECT gen_random_uuid()::text, t."event_id", btrim(t."station"), CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT "event_id", "station" FROM "trips"
  WHERE "station" IS NOT NULL AND btrim("station") <> ''
) t
ON CONFLICT ("event_id", "name") DO NOTHING;

UPDATE "trips" t
SET "station_id" = s."id"
FROM "stations" s
WHERE s."event_id" = t."event_id" AND s."name" = btrim(t."station");

ALTER TABLE "trips" DROP COLUMN "station";

-- Un pax en covoiturage avec une voiture en est le/la conducteur·ice.
UPDATE "trips" t
SET "carpool_role" = 'DRIVER', "car_id" = c."id"
FROM "cars" c
WHERE c."owner_pax_id" = t."pax_id" AND t."mode" = 'CARPOOL';

-- ---------------------------------------------------------------------------
-- shuttles : le/la conducteur·ice est un pax, plus de texte libre
-- ---------------------------------------------------------------------------
UPDATE "shuttles"
SET "comment" = CONCAT_WS(E'\n', "comment", 'Conducteur·ice (ancien texte libre) : ' || "driver_name")
WHERE "driver_pax_id" IS NULL AND "driver_name" IS NOT NULL AND btrim("driver_name") <> '';

ALTER TABLE "shuttles" DROP COLUMN "driver_name";
