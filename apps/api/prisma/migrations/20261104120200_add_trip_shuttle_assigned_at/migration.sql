-- Moment où le trajet est entré dans sa navette : quand une navette perd des
-- places, ce sont les dernier·es arrivé·es qui en sortent en premier.
ALTER TABLE "trips" ADD COLUMN "shuttle_assigned_at" TIMESTAMP(3);

-- Pour les assignations existantes, la meilleure approximation disponible.
UPDATE "trips" SET "shuttle_assigned_at" = "updated_at" WHERE "shuttle_id" IS NOT NULL;
