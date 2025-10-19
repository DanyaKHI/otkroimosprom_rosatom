import { useEffect, useMemo, useState } from 'react';
import { DefaultService } from '@/shared/api/services';
import { Group, Paper, SimpleGrid, Title, Text, Badge, Stack, Divider, Tooltip, useMantineTheme } from '@mantine/core';
import { BarChart, LineChart, PieChart } from '@mantine/charts';
import styles from './index.module.scss';

interface AdminStats {
  totals: {
    users: number;
    dialogs: number;
    messages: number;
  };
  messages_per_day: { day: string; count: number }[];
  top_users: { user_id: number; name: string; messages: number }[];
  since?: string;
}

export default function StatPage () {
  const service = useMemo(() => new DefaultService(), []);
  const [data, setData] = useState<AdminStats | null>(null);
  const theme = useMantineTheme();

  useEffect(() => {
    (async () => {
      try {
        const result = await service.getAdminStats();
          setData(result as AdminStats);
      } catch {
      }
    })();
  }, [service]);

  if (!data) return null;

  const sinceLabel = data.since ? new Date(data.since).toLocaleDateString('ru-RU') : '';

  const kpis = [
    { label: 'Пользователи', value: data.totals.users.toLocaleString('ru-RU') },
    { label: 'Диалоги', value: data.totals.dialogs.toLocaleString('ru-RU') },
    { label: 'Сообщения', value: data.totals.messages.toLocaleString('ru-RU') },
  ];

  const lineData = data.messages_per_day
    .slice()
    .sort((a, b) => new Date(a.day).getTime() - new Date(b.day).getTime())
    .map((d) => ({ date: d.day, Сообщения: d.count }));

  const usersBarData = data.top_users.map((u) => ({ user: u.name, Сообщения: u.messages }));

  const palette = [
    theme.colors.blue?.[6] || '#228be6',
    theme.colors.indigo?.[6] || '#4c6ef5',
    theme.colors.teal?.[6] || '#12b886',
    theme.colors.grape?.[6] || '#be4bdb',
    theme.colors.orange?.[6] || '#fd7e14',
    theme.colors.red?.[6] || '#fa5252',
    theme.colors.cyan?.[6] || '#15aabf',
    theme.colors.lime?.[6] || '#94d82d',
    theme.colors.pink?.[6] || '#e64980',
  ];

  const pieData = data.top_users.map((u, i) => ({ name: u.name, value: u.messages, color: palette[i % palette.length] }));
  const emptyPie = [{ name: 'Нет данных', value: 1, color: theme.colors.gray?.[5] || '#868e96' }];

  return (
    <div className={styles.statPage}>
      <Group justify="space-between" align="baseline" mb="md">
        <Title order={2}>Статистика обращений</Title>
        <Badge variant="light" size="lg">с {sinceLabel || '—'}</Badge>
      </Group>

      {/* KPI cards */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mb="lg">
        {kpis.map((kpi) => (
          <Paper key={kpi.label} withBorder p="md" radius="lg">
            <Text size="sm" c="dimmed">{kpi.label}</Text>
            <Title order={2} mt={4}>{kpi.value}</Title>
          </Paper>
        ))}
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Paper withBorder p="md" radius="lg">
          <Stack gap="xs">
            <Group justify="space-between">
              <Title order={4}>Активность по дням</Title>
              <Tooltip label="Количество входящих сообщений в день">
                <Badge variant="light">Line</Badge>
              </Tooltip>
            </Group>
            <Divider />
            <LineChart
              h={260}
              data={lineData.length ? lineData : [{ date: new Date().toISOString().slice(0,10), Сообщения: 0 }]}
              dataKey="date"
              series={[{ name: 'Сообщения' }]}
              curveType="monotone"
              xAxisProps={{ tickFormatter: (v: string) => new Date(v).toLocaleDateString('ru-RU') }}
              tooltipProps={{
                labelFormatter: (v: string) => new Date(v).toLocaleDateString('ru-RU'),
              }}
            />
          </Stack>
        </Paper>

        <Paper withBorder p="md" radius="lg">
          <Stack gap="xs">
            <Group justify="space-between">
              <Title order={4}>Топ пользователей по сообщениям</Title>
              <Tooltip label="Количество сообщений по авторам">
                <Badge variant="light">Bar</Badge>
              </Tooltip>
            </Group>
            <Divider />
            <BarChart
              h={260}
              data={usersBarData}
              dataKey="user"
              series={[{ name: 'Сообщения' }]}
              yAxisProps={{ width: 40 }}
            />
          </Stack>
        </Paper>
      </SimpleGrid>

      <Paper withBorder p="md" radius="lg" mt="lg">
        <Stack gap="xs">
          <Group justify="space-between">
            <Title order={4}>Доля сообщений по пользователям</Title>
            <Tooltip label="Распределение количества сообщений">
              <Badge variant="light">Pie</Badge>
            </Tooltip>
          </Group>
          <Divider />
          <PieChart
            h={280}
            data={pieData.length ? pieData : emptyPie}
            withLabels
          />
        </Stack>
      </Paper>
    </div>
  );
}
