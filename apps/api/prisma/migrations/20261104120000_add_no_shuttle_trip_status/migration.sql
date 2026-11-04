-- Nouveau statut pour les trajets qui n'ont pas besoin de navette (tout ce
-- qui n'est pas en train). Seul dans sa migration : Postgres n'autorise pas
-- à utiliser une valeur d'enum dans la transaction qui l'a ajoutée.
ALTER TYPE "TripStatus" ADD VALUE 'NO_SHUTTLE';
