import { getSettingsStore, type SettingsStore } from "../repositories/settingsStore";

export const LOCAL_OWNER_ID_STORE_KEY = "local-owner-id-v1";

export type OwnerIdentityErrorCode = "OWNER_RESOLVE_FAILED";

export class OwnerIdentityError extends Error {
  constructor(
    public readonly code: OwnerIdentityErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "OwnerIdentityError";
  }
}

export interface OwnerIdentityService {
  /**
   * Resolves the current owner id. Until #29 introduces real accounts this is a
   * locally generated id persisted in the settings store. #29 replaces only the
   * body of this resolver; callers and the persisted schema stay unchanged.
   */
  getCurrentOwnerId(): Promise<string>;
}

type SettingsStoreProvider = () => Promise<SettingsStore>;
type OwnerIdGenerator = () => string;

const generateLocalOwnerId: OwnerIdGenerator = () =>
  globalThis.crypto.randomUUID();

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function createOwnerIdentityService(
  provideStore: SettingsStoreProvider = getSettingsStore,
  generateOwnerId: OwnerIdGenerator = generateLocalOwnerId,
): OwnerIdentityService {
  let ownerIdPromise: Promise<string> | undefined;

  async function resolve(): Promise<string> {
    let store: SettingsStore;
    let stored: unknown;
    try {
      store = await provideStore();
      stored = await store.get<unknown>(LOCAL_OWNER_ID_STORE_KEY);
    } catch {
      throw new OwnerIdentityError(
        "OWNER_RESOLVE_FAILED",
        "owner id could not be read",
      );
    }

    if (isNonEmptyString(stored)) return stored;

    const generated = generateOwnerId();
    try {
      await store.set(LOCAL_OWNER_ID_STORE_KEY, generated);
      await store.save();
    } catch {
      throw new OwnerIdentityError(
        "OWNER_RESOLVE_FAILED",
        "owner id could not be persisted",
      );
    }
    return generated;
  }

  return Object.freeze({
    getCurrentOwnerId(): Promise<string> {
      // Cache the resolution so concurrent callers share one generated id.
      // A failure clears the cache so the next call can retry.
      ownerIdPromise ??= resolve().catch((error: unknown) => {
        ownerIdPromise = undefined;
        throw error;
      });
      return ownerIdPromise;
    },
  });
}

export const ownerIdentityService = createOwnerIdentityService();
