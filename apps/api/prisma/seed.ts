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
import type { Direction, TransportMode, TripStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const SEED_EVENT_NAME = "[SEED] Été 2026 — Charrette de test";

const OUTBOUND_DAY = "2026-09-18"; // vendredi
const RETURN_DAY = "2026-09-20"; // dimanche
const STATION = "Gare de Testville";

interface TripSeed {
  direction: Direction;
  mode: TransportMode;
  day?: string;
  time?: string;
  station?: string;
  /** Clé dans `shuttles` (voir plus bas), résolue en id après création. */
  shuttle?: ShuttleKey;
  status?: TripStatus;
  comment?: string;
}

interface PaxSeed {
  name: string;
  contactEmail?: string;
  contactPhone?: string;
  comment?: string;
  trips: TripSeed[];
}

type ShuttleKey = "outboundMorning" | "outboundAfternoon" | "returnMorning" | "returnEvening";

// Deux créneaux à l'aller (le vendredi, gare -> lieu) et deux au retour
// (le dimanche, lieu -> gare), avec des horaires qui donnent volontairement
// des temps d'attente variés une fois les paxs assignés (OK / MEDIUM / HIGH).
const SHUTTLES: Record<
  ShuttleKey,
  {
    label: string;
    day: string;
    direction: Direction;
    driverName: string;
    vehicle: string;
    departureTime: string;
    stationArrivalTime: string;
    venueReturnTime: string | null;
    comment?: string;
  }
> = {
  outboundMorning: {
    label: "Navette gare — matin",
    day: OUTBOUND_DAY,
    direction: "OUTBOUND",
    driverName: "Sam",
    vehicle: "Kangoo blanc",
    departureTime: "08:00",
    stationArrivalTime: "08:25",
    venueReturnTime: "08:50",
    comment: "Passe devant la boulangerie si besoin de croissants.",
  },
  outboundAfternoon: {
    label: "Navette gare — après-midi",
    day: OUTBOUND_DAY,
    direction: "OUTBOUND",
    driverName: "Jo",
    vehicle: "Berlingo",
    departureTime: "14:00",
    stationArrivalTime: "14:25",
    venueReturnTime: "14:50",
  },
  returnMorning: {
    label: "Navette retour — matin",
    day: RETURN_DAY,
    direction: "RETURN",
    driverName: "Sam",
    vehicle: "Kangoo blanc",
    departureTime: "09:00",
    stationArrivalTime: "09:25",
    venueReturnTime: null,
  },
  returnEvening: {
    label: "Navette retour — soir",
    day: RETURN_DAY,
    direction: "RETURN",
    driverName: "Alex",
    vehicle: "Berlingo",
    departureTime: "17:00",
    stationArrivalTime: "17:25",
    venueReturnTime: null,
    comment: "Dernière navette de la journée, prévenir si retard train.",
  },
};

// 10 paxs, chacun·e dans une situation différente pour couvrir les cas
// affichés dans le back-office et dans "mon espace".
const PAXS: PaxSeed[] = [
  {
    name: "Alix Moreau",
    contactEmail: "alix.test@example.com",
    trips: [
      {
        direction: "OUTBOUND",
        mode: "TRAIN",
        day: OUTBOUND_DAY,
        time: "08:05",
        station: STATION,
        shuttle: "outboundMorning",
        status: "ASSIGNED",
      },
      {
        direction: "RETURN",
        mode: "TRAIN",
        day: RETURN_DAY,
        time: "09:35",
        station: STATION,
        shuttle: "returnMorning",
        status: "ASSIGNED",
      },
    ],
  },
  {
    name: "Bilal Nasser",
    contactPhone: "0600000002",
    trips: [
      // Assigné mais avec un vrai écart -> teste l'indicateur "MEDIUM".
      {
        direction: "OUTBOUND",
        mode: "TRAIN",
        day: OUTBOUND_DAY,
        time: "07:50",
        station: STATION,
        shuttle: "outboundMorning",
        status: "ASSIGNED",
      },
      { direction: "RETURN", mode: "CARPOOL", day: RETURN_DAY, comment: "Repart avec Fanta." },
    ],
  },
  {
    name: "Camille Dubreuil",
    contactEmail: "camille.test@example.com",
    trips: [
      // Pas encore assigné·e -> reste en "PENDING", visible dans la liste des demandes.
      { direction: "OUTBOUND", mode: "TRAIN", day: OUTBOUND_DAY, time: "09:10", station: STATION },
    ],
  },
  {
    name: "Dee Traoré",
    trips: [
      // Gros écart à l'aller -> teste l'indicateur "HIGH".
      {
        direction: "OUTBOUND",
        mode: "TRAIN",
        day: OUTBOUND_DAY,
        time: "12:30",
        station: STATION,
        shuttle: "outboundAfternoon",
        status: "ASSIGNED",
      },
      {
        direction: "RETURN",
        mode: "TRAIN",
        day: RETURN_DAY,
        time: "17:40",
        station: STATION,
        shuttle: "returnEvening",
        status: "ASSIGNED",
      },
    ],
  },
  {
    name: "Emeka Okafor",
    contactEmail: "emeka.test@example.com",
    trips: [
      { direction: "OUTBOUND", mode: "OTHER", day: OUTBOUND_DAY, comment: "Vient en vélo." },
      {
        direction: "RETURN",
        mode: "TRAIN",
        day: RETURN_DAY,
        time: "09:15",
        station: STATION,
        shuttle: "returnMorning",
        status: "ASSIGNED",
      },
    ],
  },
  {
    name: "Fanta Camara",
    contactPhone: "0600000006",
    trips: [
      { direction: "OUTBOUND", mode: "CARPOOL" },
      { direction: "RETURN", mode: "CARPOOL", comment: "Ramène Bilal." },
    ],
  },
  {
    name: "Gwen Le Roux",
    trips: [
      {
        direction: "OUTBOUND",
        mode: "TRAIN",
        day: OUTBOUND_DAY,
        time: "08:10",
        station: STATION,
        shuttle: "outboundMorning",
        status: "ASSIGNED",
      },
      // Retour pas encore renseigné précisément -> PENDING.
      { direction: "RETURN", mode: "TRAIN", day: RETURN_DAY },
    ],
  },
  {
    name: "Hana Petit",
    contactEmail: "hana.test@example.com",
    trips: [
      // Assigné·e puis horaire changé après coup -> "à revérifier" côté organisation.
      {
        direction: "OUTBOUND",
        mode: "TRAIN",
        day: OUTBOUND_DAY,
        time: "13:50",
        station: STATION,
        shuttle: "outboundAfternoon",
        status: "TO_RECHECK",
        comment: "A changé son heure de train après l'assignation.",
      },
    ],
  },
  {
    name: "Ismaël Haddad",
    trips: [
      // Arrivé·e par ses propres moyens avant l'évènement : seulement un retour.
      {
        direction: "RETURN",
        mode: "TRAIN",
        day: RETURN_DAY,
        time: "17:15",
        station: STATION,
        shuttle: "returnEvening",
        status: "ASSIGNED",
      },
    ],
  },
  {
    name: "Jules Fontaine",
    contactEmail: "jules.test@example.com",
    comment: "Vient de s'inscrire, n'a pas encore ses horaires.",
    trips: [],
  },
];

async function main(): Promise<void> {
  // On repart d'une base propre pour l'évènement de seed uniquement.
  await prisma.event.deleteMany({ where: { name: SEED_EVENT_NAME } });

  const event = await prisma.event.create({
    data: {
      name: SEED_EVENT_NAME,
      startDate: new Date(OUTBOUND_DAY),
      endDate: new Date(RETURN_DAY),
      location: "Ferme du Chaos (lieu de test)",
      referenceStation: STATION,
    },
  });

  const shuttleIds = {} as Record<ShuttleKey, string>;
  for (const [key, shuttle] of Object.entries(SHUTTLES) as [
    ShuttleKey,
    (typeof SHUTTLES)[ShuttleKey],
  ][]) {
    const created = await prisma.shuttle.create({
      data: {
        eventId: event.id,
        ...shuttle,
        day: new Date(shuttle.day),
        capacity: 4,
      },
    });
    shuttleIds[key] = created.id;
  }

  for (const paxSeed of PAXS) {
    const pax = await prisma.pax.create({
      data: {
        eventId: event.id,
        name: paxSeed.name,
        contactEmail: paxSeed.contactEmail,
        contactPhone: paxSeed.contactPhone,
        comment: paxSeed.comment,
      },
    });

    for (const trip of paxSeed.trips) {
      await prisma.trip.create({
        data: {
          eventId: event.id,
          paxId: pax.id,
          direction: trip.direction,
          mode: trip.mode,
          day: trip.day ? new Date(trip.day) : null,
          time: trip.time ?? null,
          station: trip.station ?? null,
          shuttleId: trip.shuttle ? shuttleIds[trip.shuttle] : null,
          status: trip.status ?? "PENDING",
          comment: trip.comment ?? null,
        },
      });
    }
  }

  console.log(`Seed OK : évènement "${event.name}" (${event.id})`);
  console.log(`  - ${PAXS.length} paxs`);
  console.log(`  - ${Object.keys(SHUTTLES).length} navettes (2 aller, 2 retour)`);
  console.log(`  - lien public : /e/${event.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
