-- ---------------------------------------------------------------------------
-- Voitures sans propriétaire : créées par un pax passager·e d'un·e
-- conducteur·ice pas inscrit·e, ou par l'orga pour une navette. Supprimer un
-- pax ne supprime plus sa voiture (ses passager·es gardent leur place).
-- ---------------------------------------------------------------------------
ALTER TABLE "cars" ALTER COLUMN "owner_pax_id" DROP NOT NULL;

ALTER TABLE "cars" DROP CONSTRAINT "cars_owner_pax_id_fkey";
ALTER TABLE "cars" ADD CONSTRAINT "cars_owner_pax_id_fkey"
  FOREIGN KEY ("owner_pax_id") REFERENCES "paxs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Le véhicule d'une navette devient une voiture de l'évènement (au lieu d'un
-- texte libre). Chaque texte distinct devient une voiture sans propriétaire,
-- prêtable à n'importe quel·le conducteur·ice, avec la capacité de la navette.
-- ---------------------------------------------------------------------------
ALTER TABLE "shuttles" ADD COLUMN "vehicle_car_id" TEXT;

INSERT INTO "cars" ("id", "event_id", "owner_pax_id", "name", "seats", "lending_mode", "updated_at")
SELECT gen_random_uuid()::text, "event_id", NULL, "name", "seats", 'AVAILABLE_ANY_DRIVER', CURRENT_TIMESTAMP
FROM (
  SELECT "event_id", btrim(regexp_replace("vehicle", '\s+', ' ', 'g')) AS "name", MAX("capacity") AS "seats"
  FROM "shuttles"
  WHERE "vehicle" IS NOT NULL AND btrim("vehicle") <> ''
  GROUP BY "event_id", btrim(regexp_replace("vehicle", '\s+', ' ', 'g'))
) AS "vehicles";

UPDATE "shuttles" AS s
SET "vehicle_car_id" = c."id"
FROM "cars" AS c
WHERE c."owner_pax_id" IS NULL
  AND c."event_id" = s."event_id"
  AND c."name" = btrim(regexp_replace(s."vehicle", '\s+', ' ', 'g'));

ALTER TABLE "shuttles" DROP COLUMN "vehicle";

CREATE INDEX "shuttles_vehicle_car_id_idx" ON "shuttles"("vehicle_car_id");

ALTER TABLE "shuttles" ADD CONSTRAINT "shuttles_vehicle_car_id_fkey"
  FOREIGN KEY ("vehicle_car_id") REFERENCES "cars"("id") ON DELETE SET NULL ON UPDATE CASCADE;
