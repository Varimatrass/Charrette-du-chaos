import type {
  Car,
  DriverAvailabilitySlot,
  Event,
  Pax,
  Shuttle,
  Station,
  Trip,
} from "@prisma/client";

/**
 * Fabriques d'objets Prisma "complets" pour les tests unitaires, avec des
 * valeurs par défaut plausibles à surcharger au cas par cas.
 */

const NOW = new Date("2026-09-01T10:00:00.000Z");

export const EVENT_ID = "11111111-1111-4111-8111-111111111111";
export const PAX_ID = "22222222-2222-4222-8222-222222222222";
export const OTHER_PAX_ID = "22222222-2222-4222-8222-222222222223";
export const SHUTTLE_ID = "33333333-3333-4333-8333-333333333333";
export const TRIP_ID = "44444444-4444-4444-8444-444444444444";
export const SLOT_ID = "55555555-5555-4555-8555-555555555555";
export const STATION_ID = "66666666-6666-4666-8666-666666666666";
export const CAR_ID = "77777777-7777-4777-8777-777777777777";

export function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: EVENT_ID,
    name: "Été 2026",
    startDate: new Date("2026-09-18"),
    endDate: new Date("2026-09-20"),
    location: "Ferme du Chaos",
    openToPaxs: true,
    preferredStationId: STATION_ID,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function makePax(overrides: Partial<Pax> = {}): Pax {
  return {
    id: PAX_ID,
    eventId: EVENT_ID,
    name: "Alix Moreau",
    contactEmail: "alix@example.com",
    contactPhone: "0600000001",
    discordHandle: null,
    comment: null,
    hasVehicle: null,
    hasDrivingLicense: null,
    willingToDriveShuttle: null,
    accessToken: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function makeShuttle(overrides: Partial<Shuttle> = {}): Shuttle {
  return {
    id: SHUTTLE_ID,
    eventId: EVENT_ID,
    label: "Navette gare — matin",
    day: new Date("2026-09-18"),
    direction: "OUTBOUND",
    vehicle: "Kangoo",
    departureTime: "08:00",
    stationArrivalTime: "08:25",
    venueReturnTime: "08:50",
    capacity: 4,
    comment: null,
    driverPaxId: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: TRIP_ID,
    eventId: EVENT_ID,
    paxId: PAX_ID,
    direction: "OUTBOUND",
    mode: "TRAIN",
    day: new Date("2026-09-18"),
    time: "08:05",
    stationId: STATION_ID,
    shuttleId: null,
    status: "PENDING",
    origin: null,
    carpoolRole: null,
    carId: null,
    lookingForCarpool: false,
    comment: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function makeSlot(overrides: Partial<DriverAvailabilitySlot> = {}): DriverAvailabilitySlot {
  return {
    id: SLOT_ID,
    eventId: EVENT_ID,
    paxId: PAX_ID,
    day: new Date("2026-09-18"),
    startTime: null,
    endTime: null,
    comment: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function makeStation(overrides: Partial<Station> = {}): Station {
  return {
    id: STATION_ID,
    eventId: EVENT_ID,
    name: "Gare de Testville",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function makeCar(overrides: Partial<Car> = {}): Car {
  return {
    id: CAR_ID,
    eventId: EVENT_ID,
    ownerPaxId: OTHER_PAX_ID,
    name: "Twingo verte",
    seats: 3,
    lendingMode: "NOT_AVAILABLE",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}
