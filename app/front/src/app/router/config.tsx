/* eslint-disable react-refresh/only-export-components */
import { ComponentType, lazy, Suspense } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { RoutePaths } from "./constants";
import { PageWrapper, RouteProtection } from "@app/providers/page-wrapper";
import { Center, Loader } from "@mantine/core";

const AuthPage = lazy(() => import("@/pages/AuthPage"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));
const ChatPage = lazy(() => import("@/pages/ChatPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const StatPage = lazy(() => import("@/pages/StatPage"));
const DocumentsPage = lazy(() => import("@/pages/DocumentsPage"));


const withSuspense = (Component: ComponentType) => (
  <Suspense fallback={<Center style={{width:'100%',height:'80vh'}}><Loader color="rgba(163, 162, 162, 1)" type="dots" size="xl" /></Center>}>
    <Component />
  </Suspense>
);

export const getConfig = () => [
  {
    path: RoutePaths.LOGIN,
    element: (
      <PageWrapper
        title="Логин"
        protection={RouteProtection.PUBLIC}
        withHeader={false}
      >
        {withSuspense(AuthPage)}
      </PageWrapper>
    ),
  },
  {
    path: '/',
    element: (
      <PageWrapper protection={RouteProtection.PROTECTED} withHeader={false}>
        <Outlet/>
      </PageWrapper>
    ),
    children: [
      {
        index: true,
        element: <Navigate to={RoutePaths.CHAT} replace />,
      },
      {
        path: RoutePaths.CHAT,
        element: (
          <PageWrapper
            protection={RouteProtection.PROTECTED}
            title="Чат"
          >
            {withSuspense(ChatPage)}
          </PageWrapper>
        ),
      },
      {
        path: RoutePaths.PROFILE,
        element: (
          <PageWrapper
            protection={RouteProtection.PROTECTED}
            title="Профиль"
          >
            {withSuspense(ProfilePage)}
          </PageWrapper>
        ),
      },
      {
        path: RoutePaths.STAT,
        element: (
          <PageWrapper
            protection={RouteProtection.PROTECTED}
            title="Cтатистика"
          >
            {withSuspense(StatPage)}
          </PageWrapper>
        ),
      },
      {
        path: RoutePaths.DOCUMENTS,
        element: (
          <PageWrapper
            protection={RouteProtection.PROTECTED}
            title="Документы"
          >
            {withSuspense(DocumentsPage)}
          </PageWrapper>
        ),
      },
    ],
  },
  {
    path: "*",
    element: (
      <PageWrapper
        title="Страница не найдена"
        protection={RouteProtection.NONE}
        withHeader={false}
      >
        {withSuspense(NotFoundPage)}
      </PageWrapper>
    ),
  },
];
