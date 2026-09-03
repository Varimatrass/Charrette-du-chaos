// Script de seed — remplit la base avec un évènement de test, quelques
// navettes et une dizaine de paxs dans des états variés (assigné·es,
// en attente, à revérifier, sans navette, sans trajet du tout...) pour
// pouvoir tester l'appli sans tout resaisir à la main.
//
// Ne touche jamais aux vrais évènements créés à la main : tout ce qui est
// créé ici est rattaché à un évènement marqué "[SEED]" dans son nom, et le
// script commence par supprimer cet évènement s'il existe déjà (cascade :
// ses paxs/navettes/trajets partent avec lui) avant de tout recréer. Il est
// donc sûr de relancer `pnpm prisma:seed` autant de fois que nécessaire.
//
// Usage : pnpm prisma:seed  (depuis la racine du monorepo)

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const NOM_EVENEMENT_SEED = "[SEED] Été 2026 — Charrette de test";

const JOUR_ALLER = "2026-09-18"; // vendredi
const JOUR_RETOUR = "2026-09-20"; // dimanche

async function main(): Promise<void> {
  // On repart d'une base propre pour l'évènement de seed uniquement.
  await prisma.event.deleteMany({ where: { nom: NOM_EVENEMENT_SEED } });

  const event = await prisma.event.create({
    data: {
      nom: NOM_EVENEMENT_SEED,
      dateDebut: new Date(JOUR_ALLER),
      dateFin: new Date(JOUR_RETOUR),
      lieu: "Ferme du Chaos (lieu de test)",
      gareReference: "Gare de Testville",
    },
  });

  // ---- Navettes ----
  // Deux créneaux à l'aller (le vendredi, gare -> lieu) et deux au retour
  // (le dimanche, lieu -> gare), avec des horaires qui donnent volontairement
  // des temps d'attente variés une fois les paxs assignés (OK / MOYEN / ELEVE).
  const [navetteAllerMatin, navetteAllerApresMidi, navetteRetourMatin, navetteRetourSoir] =
    await Promise.all([
      prisma.navette.create({
        data: {
          eventId: event.id,
          libelle: "Navette gare — matin",
          jour: new Date(JOUR_ALLER),
          sens: "ALLER",
          conducteur: "Sam",
          vehicule: "Kangoo blanc",
          heureDepart: "08:00",
          heureArriveeGare: "08:25",
          heureRetourLieu: "08:50",
          capacite: 4,
          commentaire: "Passe devant la boulangerie si besoin de croissants.",
        },
      }),
      prisma.navette.create({
        data: {
          eventId: event.id,
          libelle: "Navette gare — après-midi",
          jour: new Date(JOUR_ALLER),
          sens: "ALLER",
          conducteur: "Jo",
          vehicule: "Berlingo",
          heureDepart: "14:00",
          heureArriveeGare: "14:25",
          heureRetourLieu: "14:50",
          capacite: 4,
        },
      }),
      prisma.navette.create({
        data: {
          eventId: event.id,
          libelle: "Navette retour — matin",
          jour: new Date(JOUR_RETOUR),
          sens: "RETOUR",
          conducteur: "Sam",
          vehicule: "Kangoo blanc",
          heureDepart: "09:00",
          heureArriveeGare: "09:25",
          heureRetourLieu: null,
          capacite: 4,
        },
      }),
      prisma.navette.create({
        data: {
          eventId: event.id,
          libelle: "Navette retour — soir",
          jour: new Date(JOUR_RETOUR),
          sens: "RETOUR",
          conducteur: "Alex",
          vehicule: "Berlingo",
          heureDepart: "17:00",
          heureArriveeGare: "17:25",
          heureRetourLieu: null,
          capacite: 4,
          commentaire: "Dernière navette de la journée, prévenir si retard train.",
        },
      }),
    ]);

  // ---- Paxs + trajets ----
  // 10 paxs, chacun·e dans une situation différente pour couvrir les cas
  // affichés dans le back-office et dans "mon espace".
  type TrajetSeed = {
    sens: "ALLER" | "RETOUR";
    mode: "TRAIN" | "COVOITURAGE" | "AUTRE";
    jour?: string;
    heure?: string;
    gare?: string;
    navetteId?: string;
    statut?: "EN_ATTENTE" | "ASSIGNE" | "A_REVERIFIER";
    commentaire?: string;
  };

  type PaxSeed = {
    nom: string;
    contactEmail?: string;
    contactTelephone?: string;
    commentaire?: string;
    trajets: TrajetSeed[];
  };

  const paxs: PaxSeed[] = [
    {
      nom: "Alix Moreau",
      contactEmail: "alix.test@example.com",
      trajets: [
        {
          sens: "ALLER",
          mode: "TRAIN",
          jour: JOUR_ALLER,
          heure: "08:05",
          gare: "Gare de Testville",
          navetteId: navetteAllerMatin.id,
          statut: "ASSIGNE",
        },
        {
          sens: "RETOUR",
          mode: "TRAIN",
          jour: JOUR_RETOUR,
          heure: "09:35",
          gare: "Gare de Testville",
          navetteId: navetteRetourMatin.id,
          statut: "ASSIGNE",
        },
      ],
    },
    {
      nom: "Bilal Nasser",
      contactTelephone: "0600000002",
      trajets: [
        // Assigné mais avec un vrai écart -> teste l'indicateur "MOYEN".
        {
          sens: "ALLER",
          mode: "TRAIN",
          jour: JOUR_ALLER,
          heure: "07:50",
          gare: "Gare de Testville",
          navetteId: navetteAllerMatin.id,
          statut: "ASSIGNE",
        },
        { sens: "RETOUR", mode: "COVOITURAGE", jour: JOUR_RETOUR, commentaire: "Repart avec Fanta." },
      ],
    },
    {
      nom: "Camille Dubreuil",
      contactEmail: "camille.test@example.com",
      trajets: [
        // Pas encore assigné·e -> reste en "EN_ATTENTE", visible dans la liste des demandes.
        { sens: "ALLER", mode: "TRAIN", jour: JOUR_ALLER, heure: "09:10", gare: "Gare de Testville" },
      ],
    },
    {
      nom: "Dee Traoré",
      trajets: [
        // Gros écart à l'aller -> teste l'indicateur "ELEVE".
        {
          sens: "ALLER",
          mode: "TRAIN",
          jour: JOUR_ALLER,
          heure: "12:30",
          gare: "Gare de Testville",
          navetteId: navetteAllerApresMidi.id,
          statut: "ASSIGNE",
        },
        {
          sens: "RETOUR",
          mode: "TRAIN",
          jour: JOUR_RETOUR,
          heure: "17:40",
          gare: "Gare de Testville",
          navetteId: navetteRetourSoir.id,
          statut: "ASSIGNE",
        },
      ],
    },
    {
      nom: "Emeka Okafor",
      contactEmail: "emeka.test@example.com",
      trajets: [
        { sens: "ALLER", mode: "AUTRE", jour: JOUR_ALLER, commentaire: "Vient en vélo." },
        {
          sens: "RETOUR",
          mode: "TRAIN",
          jour: JOUR_RETOUR,
          heure: "09:15",
          gare: "Gare de Testville",
          navetteId: navetteRetourMatin.id,
          statut: "ASSIGNE",
        },
      ],
    },
    {
      nom: "Fanta Camara",
      contactTelephone: "0600000006",
      trajets: [
        { sens: "ALLER", mode: "COVOITURAGE" },
        { sens: "RETOUR", mode: "COVOITURAGE", commentaire: "Ramène Bilal." },
      ],
    },
    {
      nom: "Gwen Le Roux",
      trajets: [
        {
          sens: "ALLER",
          mode: "TRAIN",
          jour: JOUR_ALLER,
          heure: "08:10",
          gare: "Gare de Testville",
          navetteId: navetteAllerMatin.id,
          statut: "ASSIGNE",
        },
        // Retour pas encore renseigné précisément -> EN_ATTENTE.
        { sens: "RETOUR", mode: "TRAIN", jour: JOUR_RETOUR },
      ],
    },
    {
      nom: "Hana Petit",
      contactEmail: "hana.test@example.com",
      trajets: [
        // Assigné·e puis horaire changé après coup -> "à revérifier" côté organisation.
        {
          sens: "ALLER",
          mode: "TRAIN",
          jour: JOUR_ALLER,
          heure: "13:50",
          gare: "Gare de Testville",
          navetteId: navetteAllerApresMidi.id,
          statut: "A_REVERIFIER",
          commentaire: "A changé son heure de train après l'assignation.",
        },
      ],
    },
    {
      nom: "Ismaël Haddad",
      trajets: [
        // Arrivé·e par ses propres moyens avant l'évènement : seulement un retour.
        {
          sens: "RETOUR",
          mode: "TRAIN",
          jour: JOUR_RETOUR,
          heure: "17:15",
          gare: "Gare de Testville",
          navetteId: navetteRetourSoir.id,
          statut: "ASSIGNE",
        },
      ],
    },
    {
      nom: "Jules Fontaine",
      contactEmail: "jules.test@example.com",
      commentaire: "Vient de s'inscrire, n'a pas encore ses horaires.",
      trajets: [],
    },
  ];

  for (const p of paxs) {
    const pax = await prisma.pax.create({
      data: {
        eventId: event.id,
        nom: p.nom,
        contactEmail: p.contactEmail,
        contactTelephone: p.contactTelephone,
        commentaire: p.commentaire,
      },
    });

    for (const t of p.trajets) {
      await prisma.trajet.create({
        data: {
          eventId: event.id,
          paxId: pax.id,
          sens: t.sens,
          mode: t.mode,
          jour: t.jour ? new Date(t.jour) : null,
          heure: t.heure ?? null,
          gare: t.gare ?? null,
          navetteId: t.navetteId ?? null,
          statut: t.statut ?? "EN_ATTENTE",
          commentaire: t.commentaire ?? null,
        },
      });
    }
  }

  console.log(`Seed OK : évènement "${event.nom}" (${event.id})`);
  console.log(`  - ${paxs.length} paxs`);
  console.log("  - 4 navettes (2 aller, 2 retour)");
  console.log(`  - lien public : /e/${event.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
