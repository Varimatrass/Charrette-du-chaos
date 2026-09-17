import type { Mock } from "vitest";
import type { PrismaService } from "../prisma/prisma.service.js";

/** Méthodes Prisma que les services utilisent sur chaque modèle. */
const DELEGATE_METHODS = [
  "findUnique",
  "findMany",
  "findFirst",
  "create",
  "update",
  "delete",
  "deleteMany",
  "count",
  "upsert",
  "updateMany",
] as const;

type DelegateMethod = (typeof DELEGATE_METHODS)[number];
type MockedDelegate = Record<DelegateMethod, Mock>;

export interface PrismaMock {
  event: MockedDelegate;
  pax: MockedDelegate;
  shuttle: MockedDelegate;
  trip: MockedDelegate;
  driverAvailabilitySlot: MockedDelegate;
  $transaction: Mock;
}

function mockDelegate(): MockedDelegate {
  return Object.fromEntries(DELEGATE_METHODS.map((method) => [method, vi.fn()])) as MockedDelegate;
}

/**
 * Double de PrismaService pour les tests unitaires : chaque modèle expose
 * des `vi.fn()` à configurer avec `mockResolvedValue`. Les tests
 * d'intégration (test/) utilisent une vraie base, pas ce mock.
 */
export function createPrismaMock(): PrismaMock {
  return {
    event: mockDelegate(),
    pax: mockDelegate(),
    shuttle: mockDelegate(),
    trip: mockDelegate(),
    driverAvailabilitySlot: mockDelegate(),
    station: mockDelegate(),
    car: mockDelegate(),
    $transaction: vi.fn(),
  };
}

/** Pour l'injection Nest : `{ provide: PrismaService, useValue: asPrismaService(mock) }`. */
export function asPrismaService(mock: PrismaMock): PrismaService {
  return mock as unknown as PrismaService;
}
