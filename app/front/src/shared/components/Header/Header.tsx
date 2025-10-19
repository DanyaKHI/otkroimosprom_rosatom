import { Container, Group } from '@mantine/core';
import styles from './Header.module.scss';
import { useEffect, useState } from 'react';
import { useUserStore } from '@/entities/user/model/user.context';

type LinkItem = {
  link: string;
  label: string;
  onlyAdmin?: boolean;
};

const links: LinkItem[] = [
  { link: '/chat', label: 'Обращения' },
  { link: '/stat', label: 'Статистика', onlyAdmin: true },
  { link: '/documents', label: 'Документы', onlyAdmin: true },
  { link: '/profile', label: 'Профиль' },
];

export const Header = () => {
  const [activeLink, setActiveLink] = useState<string | null>(null);
  const { user } = useUserStore();
  const isAdmin = user?.role === 1;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setActiveLink(window.location.pathname);
    }
  }, []);

  const items = links
    .filter((l) => !l.onlyAdmin || isAdmin)
    .map((link) => (
      <a
        key={link.label}
        href={link.link}
        className={`${styles.link} ${activeLink === link.link ? styles.activeLink : ''}`}
      >
        {link.label}
      </a>
    ));

  return (
    <header className={styles.header}>
      <Container size="lg">
        <div className={styles.inner}>
          ИИ-Атом
          <Group gap={5} visibleFrom="sm">
            {items}
          </Group>
        </div>
      </Container>
    </header>
  );
};
