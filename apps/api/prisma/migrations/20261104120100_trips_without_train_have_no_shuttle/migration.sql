-- Les navettes sont réservées aux trajets en train : les autres trajets
-- (covoit, autre, pas encore décidé) sortent de leur navette éventuelle et
-- passent en NO_SHUTTLE.
UPDATE "trips"
SET "shuttle_id" = NULL, "status" = 'NO_SHUTTLE'
WHERE "mode" IS DISTINCT FROM 'TRAIN';
