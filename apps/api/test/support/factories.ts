import type { Car, Event, Pax, Shuttle, Station, Trip } from "@prisma/client";
import type { PrismaService } from "../../src/prisma/prisma.service.js";

/**
 * Insère directement en base les objets dont un test a besoin comme
 * point de départ (pour ne pas repasser par toute l'API à chaque fois).
 */
export function factories(prisma: PrismaService) {
  return {
    event: (overrides: Partial<Event> = {}) =>
      prisma.event.create({
        data: {
          name: "Été 2026",
          startDate: new Date("2026-09-18"),
          endDate: new Date("2026-09-20"),
          location: "Ferme du Chaos",
          openToPaxs: true,
          ...overrides,
        },
      }),

    pax: (eventId: string, overrides: Partial<Pax> = {}) =>
      prisma.pax.create({ data: { eventId, name: "Alix Moreau", ...overrides } }),

    shuttle: (eventId: string, overrides: Partial<Shuttle> = {}) =>
      prisma.shuttle.create({
        data: {
          eventId,
          label: "Navette gare — matin",
          day: new Date("2026-09-18"),
          direction: "OUTBOUND",
          departureTime: "08:00",
          stationArrivalTime: "08:25",
          capacity: 4,
          ...overrides,
        },
      }),

    station: (eventId: string, overrides: Partial<Station> = {}) =>
      prisma.station.create({ data: { eventId, name: "Gare de Testville", ...overrides } }),

    car: (eventId: string, ownerPaxId: string, overrides: Partial<Car> = {}) =>
      prisma.car.create({
        data: { eventId, ownerPaxId, name: "Twingo verte", seats: 2, ...overrides },
      }),

    trip: (eventId: string, paxId: string, overrides: Partial<Trip> = {}) =>
      prisma.trip.create({
        data: { eventId, paxId, direction: "OUTBOUND", mode: "TRAIN", time: "08:05", ...overrides },
      }),
  };
}
