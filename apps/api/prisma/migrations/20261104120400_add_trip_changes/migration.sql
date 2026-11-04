-- Historique des modifications faites par un pax sur un trajet déjà placé
-- dans une navette : l'orga voit ce qui a changé (avant → après) et le marque
-- comme vu une fois vérifié.
CREATE TABLE "trip_changes" (
    "id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "acknowledged_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_changes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "trip_changes_trip_id_idx" ON "trip_changes"("trip_id");

ALTER TABLE "trip_changes" ADD CONSTRAINT "trip_changes_trip_id_fkey"
  FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
