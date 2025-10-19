import { observer } from "mobx-react-lite";
import { ReactNode, useEffect, useMemo } from "react";
import { StoreGate } from "@/shared/stores/StoreGate";
import { UserStoreContext } from "./user.context";
import { UserStore } from "./user.store";

interface Props {
  children: ReactNode;
}

export const UserProvider = observer(({ children }: Props) => {
  const store = useMemo(() => new UserStore(), []);

  useEffect(() => {
    store.init().catch(console.error);
  }, [store]);

  return (
    <StoreGate store={store}>
      <UserStoreContext.Provider value={store}>
        {children}
      </UserStoreContext.Provider>
    </StoreGate>
  );
});
