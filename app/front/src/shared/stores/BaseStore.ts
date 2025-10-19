import { makeObservable, observable, action, computed } from "mobx";

export type Status = "idle" | "initializing" | "ready" | "critical-error";

export interface StoreError {
  message: string;
  error?: unknown;
}

export abstract class BaseStore {
  @observable status: Status = "idle";
  @observable error: StoreError | null = null;

  private _resolve!: () => void;
  readonly readyPromise: Promise<void>;

  protected lastInitArgs: unknown[] = [];

  constructor() {
    makeObservable(this);
    this.readyPromise = this._createReadyPromise();
  }

  @action protected setInitializing() {
    this.status = "initializing";
    this.error = null;
  }

  @action protected setReady() {
    this.status = "ready";
    this.error = null;
    this._resolve?.();
  }

  @action protected setError(e: StoreError, throwError = true) {
    this.error = e;

    if (throwError) {
      throw new Error(e.message);
    }
  }

  @action protected setCriticalError(e: StoreError) {
    this.status = "critical-error";
    this.error = e;
    this._resolve?.();
  }

  @action public clearError() {
    this.error = null;
  }

  @action protected resetBase() {
    // @ts-expect-error — обновляем readonly внутри базового класса
    this.readyPromise = this._createReadyPromise();
    this.status = "idle";
    this.error = null;
  }

  public abstract reset(): void;

  @action
  async init(..._args: unknown[]): Promise<void> {
    this.lastInitArgs = _args;
    this.setInitializing();
    this.setReady();
  }

  @action
  async reload(...overrideArgs: unknown[]): Promise<void> {
    const args = overrideArgs.length ? overrideArgs : this.lastInitArgs;
    this.reset();
    await this.init(...args);
  }

  @computed get isIdle() {
    return this.status === "idle";
  }

  @computed get isInitializing() {
    return this.status === "initializing";
  }

  @computed get isReady() {
    return this.status === "ready";
  }

  @computed get hasError() {
    return this.error !== null;
  }

  @computed get isCriticalError() {
    return this.status === "critical-error";
  }

  private _createReadyPromise(): Promise<void> {
    return new Promise<void>((resolve) => (this._resolve = resolve));
  }
}
