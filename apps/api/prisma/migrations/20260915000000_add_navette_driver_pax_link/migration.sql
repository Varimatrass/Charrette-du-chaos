-- Lien optionnel entre une navette et le pax qui la conduit réellement
-- (Phase 4 : permet d'afficher son téléphone aux co-passager·es de cette
-- navette précise, sans le dupliquer sur la navette). Purement additif,
-- nullable, ne casse rien pour les navettes existantes.

ALTER TABLE "navettes" ADD COLUMN "driver_pax_id" TEXT;

ALTER TABLE "navettes"
  ADD CONSTRAINT "navettes_driver_pax_id_fkey"
  FOREIGN KEY ("driver_pax_id") REFERENCES "paxs"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "navettes_driver_pax_id_idx" ON "navettes"("driver_pax_id");
