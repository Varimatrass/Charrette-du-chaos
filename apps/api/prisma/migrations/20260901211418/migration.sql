-- CreateEnum
CREATE TYPE "Sens" AS ENUM ('ALLER', 'RETOUR');

-- CreateEnum
CREATE TYPE "ModeTransport" AS ENUM ('TRAIN', 'COVOITURAGE', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutTrajet" AS ENUM ('EN_ATTENTE', 'ASSIGNE', 'A_REVERIFIER');

-- CreateTable
CREATE TABLE "editions" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "date_debut" DATE NOT NULL,
    "date_fin" DATE NOT NULL,
    "lieu" TEXT NOT NULL,
    "gare_reference" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "editions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paxs" (
    "id" TEXT NOT NULL,
    "edition_id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "contact_email" TEXT,
    "contact_telephone" TEXT,
    "commentaire" TEXT,
    "access_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paxs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "navettes" (
    "id" TEXT NOT NULL,
    "edition_id" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "jour" DATE NOT NULL,
    "sens" "Sens" NOT NULL,
    "conducteur" TEXT,
    "vehicule" TEXT,
    "heure_depart" TEXT NOT NULL,
    "heure_arrivee_gare" TEXT NOT NULL,
    "heure_retour_lieu" TEXT,
    "capacite" INTEGER NOT NULL,
    "commentaire" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "navettes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trajets" (
    "id" TEXT NOT NULL,
    "edition_id" TEXT NOT NULL,
    "pax_id" TEXT NOT NULL,
    "sens" "Sens" NOT NULL,
    "mode" "ModeTransport" NOT NULL,
    "jour" DATE,
    "heure" TEXT,
    "gare" TEXT,
    "navette_id" TEXT,
    "statut" "StatutTrajet" NOT NULL DEFAULT 'EN_ATTENTE',
    "commentaire" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trajets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "paxs_access_token_key" ON "paxs"("access_token");

-- CreateIndex
CREATE INDEX "paxs_edition_id_idx" ON "paxs"("edition_id");

-- CreateIndex
CREATE INDEX "navettes_edition_id_idx" ON "navettes"("edition_id");

-- CreateIndex
CREATE INDEX "trajets_edition_id_idx" ON "trajets"("edition_id");

-- CreateIndex
CREATE INDEX "trajets_navette_id_idx" ON "trajets"("navette_id");

-- CreateIndex
CREATE UNIQUE INDEX "trajets_pax_id_sens_key" ON "trajets"("pax_id", "sens");

-- AddForeignKey
ALTER TABLE "paxs" ADD CONSTRAINT "paxs_edition_id_fkey" FOREIGN KEY ("edition_id") REFERENCES "editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "navettes" ADD CONSTRAINT "navettes_edition_id_fkey" FOREIGN KEY ("edition_id") REFERENCES "editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trajets" ADD CONSTRAINT "trajets_edition_id_fkey" FOREIGN KEY ("edition_id") REFERENCES "editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trajets" ADD CONSTRAINT "trajets_pax_id_fkey" FOREIGN KEY ("pax_id") REFERENCES "paxs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trajets" ADD CONSTRAINT "trajets_navette_id_fkey" FOREIGN KEY ("navette_id") REFERENCES "navettes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
