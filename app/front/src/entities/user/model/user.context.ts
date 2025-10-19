import { createContext, useContext } from "react";
import { UserStore } from "./user.store";

export const UserStoreContext = createContext<UserStore | null>(null);

export const useUserStore = (): UserStore => {
  const ctx = useContext(UserStoreContext);
  if (!ctx) throw new Error("UserStoreContext is not provided");
  return ctx;
};
