import { ReactNode } from "react";
import styles from "./LayoutWithHeader.module.scss";
import { Header } from "@/shared/components/Header/Header";
import { Container } from "@mantine/core";

interface ILayoutWithheaderProps {
  children: ReactNode;
}

export const LayoutWithHeader = ({ children }: ILayoutWithheaderProps) => {
  return (
    <div className={styles.layoutWithHeader}>
      <Header/>
      <Container className={styles.layoutWithHeaderContent} size="lg">
        {children}
      </Container>
    </div>
  );
};
