/// <reference types="vite/client" />
import {
  Configuration,
  ResponseError,
  FetchError,
  // DefaultApi,
} from "@/shared/api/generated";
import { TokenStorage } from "@/shared/api/utils";

export type ApiSuccess<T> = { data: T; isSuccess: true };
export type ApiFailure = {
  error: Error | ResponseError | FetchError;
  isSuccess: false;
};
export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

const isResponseError = (error: unknown): error is ResponseError =>
  error instanceof ResponseError;

export abstract class BaseService {
  protected readonly baseUrl: string;

  // private static refreshPromise: Promise<boolean> | null = null;

  constructor() {
    this.baseUrl = import.meta.env.VITE_BACKEND_URL ?? "/";
  }

  protected api<T>(ApiCtor: new (config: Configuration) => T): T {
    const cfg = new Configuration({
      basePath: this.baseUrl,
      accessToken: () => TokenStorage.getAccessToken?.() ?? "",
    });
    return new ApiCtor(cfg);
  }

  protected async safeApiCall<T>(
    apiCall: () => Promise<T>,
  ): Promise<ApiResult<T>> {
    try {
      const data = await apiCall();
      return { isSuccess: true, data };
    } catch (err) {
      if (isResponseError(err) && err.response.status === 401) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          try {
            const data = await apiCall();
            return { isSuccess: true, data };
          } catch (err2) {
            return {
              isSuccess: false,
              error: isResponseError(err2)
                ? err2
                : new Error("Unknown error after token refresh"),
            };
          }
        }
      }
      return {
        isSuccess: false,
        error: isResponseError(err)
          ? err
          : new Error("Failed to refresh access token"),
      };
    }
  }

  protected async simpleApiCall<T>(
    apiCall: () => Promise<T>,
  ): Promise<T | undefined> {
    const result = await this.safeApiCall(apiCall);
    return result.isSuccess ? result.data : undefined;
  }

  protected async booleanApiCall(
    apiCall: () => Promise<void>,
  ): Promise<boolean> {
    const result = await this.safeApiCall(apiCall);
    return result.isSuccess;
  }

  private async refreshAccessToken(): Promise<boolean> {
    // const refreshToken = TokenStorage.getRefreshToken();
    // if (!refreshToken) return false;

    // if (!BaseService.refreshPromise) {
    //   BaseService.refreshPromise = (async () => {
    //     try {
    //       const cfg = new Configuration({ basePath: this.baseUrl });
    //       const authApi = new DefaultApi(cfg);

    //       const response = await authApi.refreshToken({
    //         refreshTokenRequestDto: { refreshToken },
    //       });

    //       TokenStorage.setAccessToken(response.accessToken);
    //       TokenStorage.setRefreshToken(response.refreshToken);
    //       TokenStorage.setUserData(response.user);

    //       return true;
    //     } catch {
    //       TokenStorage.clear();
    //       return false;
    //     } finally {
    //       BaseService.refreshPromise = null;
    //     }
    //   })();
    // }

    // return BaseService.refreshPromise;
    return true;
  }
}
