import { createBrowserRouter } from "react-router-dom";
import { getConfig } from "./config";

export const createRouter = () => {
  const routes = getConfig();
  return createBrowserRouter(routes);
};
