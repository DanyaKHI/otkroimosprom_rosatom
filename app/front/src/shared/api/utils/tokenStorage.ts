export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class TokenStorage {
  private static readonly ACCESS_TOKEN_KEY = "accessToken";
  private static readonly REFRESH_TOKEN_KEY = "refreshToken";
  private static readonly USER_DATA_KEY = "userData";

  private static storage: StorageLike = localStorage;

  static setStorage(storage: StorageLike): void {
    this.storage = storage;
  }

  private static getItem(key: string): string | null {
    return this.storage.getItem(key);
  }

  private static setItem(key: string, value: string | undefined): void {
    if (value) {
      this.storage.setItem(key, value);
    } else {
      this.storage.removeItem(key);
    }
  }

  static getAccessToken(): string | null {
    return this.getItem(this.ACCESS_TOKEN_KEY);
  }

  static setAccessToken(token: string | undefined): void {
    this.setItem(this.ACCESS_TOKEN_KEY, token);
  }

  static getRefreshToken(): string | null {
    return this.getItem(this.REFRESH_TOKEN_KEY);
  }

  static setRefreshToken(token: string | undefined): void {
    this.setItem(this.REFRESH_TOKEN_KEY, token);
  }

  static getUserData<T = unknown>(): T | null {
    const raw = this.getItem(this.USER_DATA_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  static setUserData<T = unknown>(userData: T | undefined): void {
    if (userData) {
      this.setItem(this.USER_DATA_KEY, JSON.stringify(userData));
    } else {
      this.setItem(this.USER_DATA_KEY, undefined);
    }
  }

  static clear(): void {
    this.setAccessToken(undefined);
    this.setRefreshToken(undefined);
    this.setUserData(undefined);
  }

  static hasValidAccessToken(): boolean {
    return Boolean(this.getAccessToken());
  }

  static getAuthorizationHeader(): string | undefined {
    const token = this.getAccessToken();
    return token ? `Bearer ${token}` : undefined;
  }

  static hasTokens(): boolean {
    return Boolean(this.getAccessToken() && this.getRefreshToken());
  }
}
