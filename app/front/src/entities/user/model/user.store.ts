import {
  action,
  computed,
  makeObservable,
  observable,
  override,
  runInAction,
} from "mobx";
import { DefaultService } from "@/shared/api/services";
import { TokenStorage } from "@/shared/api/utils";
import { BaseStore } from "@/shared/stores/BaseStore";
import { UserOut } from "@/shared/api/generated";

export class UserStore extends BaseStore {
  // === СЕРВИСЫ ===
  private readonly service = new DefaultService();

  // === ДАННЫЕ ===
  @observable user: UserOut | null = null;

  constructor() {
    super();
    makeObservable(this);
  }

  @computed
  get isAuth(): boolean {
    return Boolean(this.user && TokenStorage.getAccessToken());
  }

  // === ИНИЦИАЛИЗАЦИЯ И СБРОС ===
  @override
  async init() {
    if (this.status !== "idle") return;
    this.setInitializing();

    try {
      const resp = await this.service.validateToken();

      runInAction(() => {
        if (resp.isSuccess) this.user = resp.data;
      });

      this.setReady();
    } catch (e) {
      this.setCriticalError({ message: "Не удалось авторизоваться", error: e });
    }    
  }

  @action
  public reset(): void {
    super.resetBase();
    this.user = null;
  }

  // === СИНХРОННЫЕ ДЕЙСТВИЯ ===
  @action
  logout = (): void => {
    this.user = null;
    this.service.logout();
  };

  // === АСИНХРОННЫЕ ДЕЙСТВИЯ ===
  @action
  login = async (username: string, password: string): Promise<boolean> => {
    const resp = await this.service.login(username, password);

    if (resp.isSuccess && resp.data) {
      runInAction(() => {
        this.user = resp.data.user;
      });
    }
    return resp.isSuccess;
  };
}
