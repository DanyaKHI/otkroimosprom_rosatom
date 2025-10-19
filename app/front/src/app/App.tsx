import { MantineProvider } from "@mantine/core";
import { RouterProvider } from "react-router-dom";
import { createRouter } from "@/app/router";
import { logEnv } from "@/shared/config/env/logEnv";
import "./index.css";
import { UserProvider } from "@/entities/user/model/UserProvider";

logEnv();

const router = createRouter();

export const App = () => {
  return (
    <MantineProvider defaultColorScheme="light">
      <UserProvider>
        <RouterProvider router={router} />
      </UserProvider>
    </MantineProvider>
  );
};
