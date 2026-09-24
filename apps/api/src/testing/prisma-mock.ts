import type { Mock } from "vitest";
import type { PrismaService } from "../prisma/prisma.service.js";

/** Méthodes Prisma que les services utilisent sur chaque modèle. */
const DELEGATE_METHODS = [
  "findUnique",
  "findUniqueOrThrow",
  "findMany",
  "findFirst",
  "create",
  "createMany",
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
  station: MockedDelegate;
  car: MockedDelegate;
  $transaction: Mock;
  $queryRaw: Mock;
}

function mockDelegate(): MockedDelegate {
  return Object.fromEntries(DELEGATE_METHODS.map((method) => [method, vi.fn()])) as MockedDelegate;
}

/**
 * Double de PrismaService pour les tests unitaires : chaque modèle expose
 * des `vi.fn()` à configurer avec `mockResolvedValue`. Les tests
 * d'intégration (test/) utilisent une vraie base, pas ce mock.
 *
 * `$transaction(callback)` appelle le callback avec le mock lui-même, pour
 * que le code transactionnel s'exécute sur les mêmes `vi.fn()`. Sa forme
 * tableau (`$transaction([...])`) reste à configurer dans chaque test.
 */
export function createPrismaMock(): PrismaMock {
  const mock: PrismaMock = {
    event: mockDelegate(),
    pax: mockDelegate(),
    shuttle: mockDelegate(),
    trip: mockDelegate(),
    driverAvailabilitySlot: mockDelegate(),
    station: mockDelegate(),
    car: mockDelegate(),
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  };
  mock.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === "function" ? arg(mock) : undefined,
  );
  return mock;
}

/** Pour l'injection Nest : `{ provide: PrismaService, useValue: asPrismaService(mock) }`. */
export function asPrismaService(mock: PrismaMock): PrismaService {
  return mock as unknown as PrismaService;
}
