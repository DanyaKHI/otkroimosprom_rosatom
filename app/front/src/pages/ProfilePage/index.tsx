import { IconAt, IconPhoneCall } from '@tabler/icons-react';
import { Avatar, Group, Text } from '@mantine/core';
import styles from './index.module.scss';
import { useUserStore } from '@/entities/user/model/user.context';

const ProfilePage = () => {
  const {user} = useUserStore();
  return (
    <div className={styles.profilePage}>
      <Group wrap="nowrap">
        <Avatar
          size={94}
          radius="md"
        >{'Иван Иванов'[0]?.toUpperCase() || '🤖'}</Avatar>
        <div>
          <Text fz="xs" tt="uppercase" fw={700} c="dimmed">
            {user?.status}
          </Text>

          <Text fz="lg" fw={500} className={styles.name}>
            {user?.name}
          </Text>

          <Group wrap="nowrap" gap={10} mt={3}>
            <IconAt stroke={1.5} size={16} className={styles.icon} />
            <Text fz="xs" c="dimmed">
              {user?.email}
            </Text>
          </Group>

          <Group wrap="nowrap" gap={10} mt={5}>
            <IconPhoneCall stroke={1.5} size={16} className={styles.icon} />
            <Text fz="xs" c="dimmed">
              {user?.phone}
            </Text>
          </Group>
        </div>
      </Group>
    </div>
  );
};

export default ProfilePage;
