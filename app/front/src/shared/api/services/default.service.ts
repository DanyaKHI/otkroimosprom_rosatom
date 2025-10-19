import { BaseService, ApiResult, TokenStorage } from "@shared/api/utils";
import { CreateDialogRequest, DefaultApi, DialogOut, DialogWithMessagesOut, LoginResponse, MessageView, SendMessageRequest, UserOut } from "@/shared/api/generated";

export class DefaultService extends BaseService {
  async login(
    email: string,
    password: string,
  ): Promise<ApiResult<LoginResponse>> {
    const result = await this.safeApiCall(() =>
      this.api(DefaultApi).loginLoginPost({
        loginRequest: { email, password },
      }),
    );

    if (result.isSuccess && result.data) {
      this.saveAuthData(result.data);
    }

    return result;
  }

  async validateToken(): Promise<ApiResult<UserOut>> {
    try {
      const userData = TokenStorage.getUserData<UserOut>();
      if (!userData) {
        return {
          isSuccess: false,
          error: new Error("No user data found in token storage"),
        };
      }

      return { isSuccess: true, data: userData };
    } catch (e) {
      return {
        isSuccess: false,
        error: e instanceof Error ? e : new Error("Token storage error"),
      };
    }
  }

  logout(): void {
    TokenStorage.clear();
  }

  private saveAuthData(data: LoginResponse) {
    const { access_token,  refresh_token, user } = data;
    TokenStorage.setAccessToken(access_token);
    TokenStorage.setRefreshToken(refresh_token);
    TokenStorage.setUserData(user);
  }

  async getAdminDialogs(): Promise<Array<DialogWithMessagesOut> | undefined>{
    return this.simpleApiCall(() =>
      this.api(DefaultApi).adminListDialogsWithMessagesAdminDialogsGet(),
    );
  }

  async getUserDialogs(): Promise<Array<DialogWithMessagesOut> | undefined>{
    return this.simpleApiCall(() =>
      this.api(DefaultApi).userDialogsWithMessagesUserDialogsGet(),
    );
  }

  async getAdminStats(): Promise<any | undefined> {
    return this.simpleApiCall(() => this.api(DefaultApi).adminStatsAdminStatsGet());
  }

  async createDialog(payload: CreateDialogRequest): Promise<DialogOut | undefined> {
    return this.simpleApiCall(() =>
      this.api(DefaultApi).createDialogEndpointUserDialogsPost({ createDialogRequest: payload } as any),
    );
  }

  async sendMessage(payload: SendMessageRequest): Promise<MessageView | undefined> {
    return this.simpleApiCall(() =>
      this.api(DefaultApi).sendMessageEndpointMessagesPost({ sendMessageRequest: payload } as any),
    );
  }
}
