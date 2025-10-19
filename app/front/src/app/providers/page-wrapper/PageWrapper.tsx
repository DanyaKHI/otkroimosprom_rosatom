import { observer } from "mobx-react-lite";
import { ReactNode, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { RoutePaths } from "@/app/router/constants";
import { useUserStore } from "@/entities/user/model/user.context";
import { LayoutWithHeader } from "@/shared/components/LayoutWithHeader/LayoutWithHeader";

// eslint-disable-next-line react-refresh/only-export-components
export enum RouteProtection {
  PROTECTED = "protected",
  PUBLIC = "public",
  NONE = "none",
}

export interface PageWrapperProps {
  children: ReactNode;
  title?: string;
  protection?: RouteProtection;
  redirectPath?: string;
  withHeader?: boolean;
}

export const PageWrapper = observer((props: PageWrapperProps) => {
  const {
    children,
    title,
    protection = RouteProtection.PROTECTED,
    redirectPath = RoutePaths.LOGIN,
    withHeader = true,
  } = props;
  const userStore = useUserStore();


  useEffect(() => {
    if (title) {
      document.title = `${import.meta.env.VITE_PROJECT_TITLE} | ${title}`;
    }
  }, [title]);

  if (protection === RouteProtection.PROTECTED && !userStore.isAuth) {
    return <Navigate to={redirectPath} replace />;
  }

  if (protection === RouteProtection.PUBLIC && userStore.isAuth) {
    return <Navigate to="/" replace />;
  }

  if (withHeader){
    return <LayoutWithHeader>{children}</LayoutWithHeader>
  }

  return <>{children}</>;
});
