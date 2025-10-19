import { notifications } from "@mantine/notifications";
import { observer } from "mobx-react-lite";
import { ReactNode, useEffect } from "react";

export interface BaseStoreLike<Args extends unknown[]> {
  init: (...args: Args) => Promise<void>;
  reload: (...args: Args) => Promise<void>;
  dispose?: () => void;
  reset: () => void;

  isIdle: boolean;
  isInitializing: boolean;
  isReady: boolean;
  hasError: boolean;
  isCriticalError: boolean;
  error: { message: string } | null;
}

type NullableArgs<T extends unknown[]> = {
  [K in keyof T]: T[K] | null | undefined;
};

type ErrorRenderProps = {
  title: string;
  onReload: () => void;
  onBack: () => void;
  error: { message: string } | null;
};

interface StoreGateProps<
  TStore extends BaseStoreLike<TArgs>,
  TArgs extends unknown[],
> {
  store: TStore;
  initArgs?: NullableArgs<TArgs>;
  children: ReactNode;

  renderLoading?: () => ReactNode;

  renderCriticalError?: (props: ErrorRenderProps) => ReactNode;

  errorToast?: (error: { message: string } | null) => void;
}

function allPresent<Arr extends unknown[]>(arr: Arr): arr is Arr {
  return arr.every((x) => x !== null && x !== undefined);
}

export const StoreGate = observer(
  <TStore extends BaseStoreLike<TArgs>, TArgs extends unknown[]>({
    store,
    initArgs,
    children,
    renderLoading,
    renderCriticalError,
    errorToast,
  }: StoreGateProps<TStore, TArgs>) => {
    useEffect(() => {
      const args = (initArgs ?? []) as unknown as TArgs;

      if (allPresent(args as unknown as unknown[])) void store.init(...args);

      return () => {
        store.dispose?.();
        store.reset();
      };
    }, [store, ...(initArgs ?? [])]);

    useEffect(() => {
      if (store.hasError && !store.isCriticalError) {
        if (errorToast) {
          errorToast(store.error ?? null);
        } else if (store.error?.message) {
          notifications.show({
            title: "Ошибка",
            message: store.error.message,
            color: "red",
            autoClose: 4000,
          });
        }
      }
    }, [
      store.hasError,
      store.isCriticalError,
      store.error?.message,
      errorToast,
    ]);

    if (store.isInitializing || store.isIdle) {
      return <>{renderLoading ? renderLoading() : <div>Загрузка</div>}</>;
    }

    if (store.isCriticalError) {
      const title = store.error?.message ?? "Неизвестная ошибка";
      const args = (initArgs ?? []) as unknown as TArgs;
      const doReload = () => {
        if (allPresent(args as unknown as unknown[]))
          void store.reload(...args);
      };

      if (renderCriticalError) {
        const onBack = () => {
          if (typeof window !== "undefined" && window.history?.length) {
            window.history.back();
          }
        };
        return renderCriticalError({
          title,
          onReload: doReload,
          onBack,
          error: store.error ?? null,
        });
      }

      return (
        <div>Ошибка</div>
      );
    }

    return <>{children}</>;
  },
);
