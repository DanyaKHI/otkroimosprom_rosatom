import { useEffect, useMemo, useState } from 'react';
import { Chat } from '@/widgets/Chat/Chat';
import {
  Paper,
  Group,
  Text,
  Button,
  Stack,
  ScrollArea,
  Divider,
  TextInput,
  ActionIcon,
  Tooltip,
  Badge,
} from '@mantine/core';
import { IconPlus, IconSearch, IconMessageCircle2, IconUserShield } from '@tabler/icons-react';
import styles from './index.module.scss';

import { useUserStore } from '@/entities/user/model/user.context';
import type { SendMessageRequest, DialogWithMessagesOut, DialogOut, MessageView } from '@/shared/api/generated';
import { DefaultService } from '@/shared/api/services';

const categoryTypeConfig: Record<
  any,
  { color: string; label: string }
> = {
  IT: { color: "blue", label: "IT" },
  AD: { color: "green", label: "Бух" },
  HR: { color: "red", label: "HR" },
};

type DialogListItem = DialogOut | DialogWithMessagesOut;

function formatTimeISO(iso?: string | Date | null) {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d?.toLocaleString?.() ?? '—';
}

export default function ChatPage () {
  const { user } = useUserStore();
  const isAdmin = user?.role === 1;
  const currentUserId = user?.id ?? null;

  const service = useMemo(() => new DefaultService(), []);

  const [dialogs, setDialogs] = useState<DialogListItem[]>([]);
  const [messagesByDialog, setMessagesByDialog] = useState<Record<string, MessageView[]>>({});
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const list = isAdmin ? (await service.getAdminDialogs()) ?? [] : (await service.getUserDialogs()) ?? [];
        setDialogs(list as DialogListItem[]);
        const initial: Record<string, MessageView[]> = {};
        for (const d of list as DialogListItem[]) {
          const key = String((d as any).id);
          const msgs = (d as any).messages as MessageView[] | undefined;
          if (Array.isArray(msgs)) initial[key] = msgs;
        }
        setMessagesByDialog((prev) => ({ ...initial, ...prev }));
        if (!activeId && list.length > 0) setActiveId(String((list[0] as any).id));
      } finally {
        setLoading(false);
      }
    })();
  }, [isAdmin]);

  useEffect(() => {
    (async () => {
      const id = activeId;
      if (!id) return;
      if (messagesByDialog[id]) return;
      try {
        let msgs: MessageView[] | null = null;
        if (typeof (service as any).getDialogById === 'function') {
          const full = await (service as any).getDialogById({ id });
          msgs = (full?.messages ?? null) as MessageView[] | null;
        }
        if (!msgs && typeof (service as any).getDialogMessages === 'function') {
          msgs = (await (service as any).getDialogMessages({ dialog_id: id })) ?? [];
        }
        if (msgs) setMessagesByDialog((prev) => ({ ...prev, [id]: msgs! }));
      } catch {
      }
    })();
  }, [activeId]);

  const visibleDialogs = useMemo(() => {
    const base = dialogs;
    if (!query.trim()) return base;
    const q = query.toLowerCase();
    return base.filter((d) => String((d as any).id ?? '').toLowerCase().includes(q));
  }, [dialogs, query]);

  const activeDialog = useMemo(() => dialogs.find((d) => String((d as any).id) === String(activeId)) ?? null, [dialogs, activeId]);

  const activeMessages: MessageView[] = useMemo(() => {
    if (!activeDialog) return [];
    return messagesByDialog[String((activeDialog as any).id)] ?? [];
  }, [messagesByDialog, activeDialog?.id]);

  const pageTitle = isAdmin ? 'Обращения пользователей' : 'Мои обращения';

  const addDialog = async () => {
    try {
      const created = (await service.createDialog({other_user_id: 1}));
      if (created && (created as any).id != null) {
        const id = String((created as any).id);
        setDialogs((prev) => [created, ...prev]);
        setActiveId(id);
        setMessagesByDialog((prev) => ({ ...prev, [id]: [] }));
      }
    } catch {
    }
  };

  const handleSend = async (text: string) => {
    if (!activeDialog || !text.trim()) return;

    const dialogId = String((activeDialog as any).id);

    const optimistic: MessageView = {
      id: `local-${Date.now()}`,
      dialog_id: (activeDialog as any).id as any,
      ts: new Date(),
      text,
      author_user_id: (currentUserId ?? undefined) as any,
    } as unknown as MessageView;

    setMessagesByDialog((prev) => ({ ...prev, [dialogId]: [...(prev[dialogId] ?? []), optimistic] }));

    try {
      const payload: SendMessageRequest = {
        dialog_id: (activeDialog as any).id as any,
        text,
      } as unknown as SendMessageRequest;

      const saved = (await service.sendMessage(payload)) as unknown as MessageView | null;

      if (saved && (saved as any).id != null) {
        setMessagesByDialog((prev) => {
          const list = (prev[dialogId] ?? []).filter((m) => m.id !== optimistic.id);
          return { ...prev, [dialogId]: [...list, saved] };
        });
      } else if (typeof (service as any).getDialogMessages === 'function') {
        const fresh: MessageView[] = (await (service as any).getDialogMessages({ dialog_id: dialogId })) ?? [];
        setMessagesByDialog((prev) => ({ ...prev, [dialogId]: fresh }));
      }
    } catch {
    }
  };

  const openDialog = (id: string) => setActiveId(id);

  return (
    <div className={styles.chatPage}>
      <Paper withBorder radius="lg" className={styles.sidebar}>
        <Group p="md" justify="space-between">
          <Group gap="xs">
            {isAdmin ? <IconUserShield size={18} /> : <IconMessageCircle2 size={18} />}
            <Text fw={600}>{pageTitle}</Text>
          </Group>
          {!isAdmin && (
            <Tooltip label="Создать новое обращение">
              <ActionIcon variant="filled" radius="md" onClick={addDialog} aria-label="Новое обращение">
                <IconPlus size={18} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
        <Divider />
        <Group p="sm" className={styles.sidebarHeader}>
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            leftSection={<IconSearch size={16} />}
            placeholder="Поиск по ID или участникам"
            aria-label="Поиск обращений"
            style={{ width: '100%' }}
          />
        </Group>
        <Divider />
        <ScrollArea className={styles.sidebarList} type="scroll" scrollbarSize={3} offsetScrollbars>
          <Stack p="sm" gap="xs">
            {visibleDialogs.map((d) => {
              const id = String((d as any).id);
              const isActive = id === activeId;
              const msgs = messagesByDialog[id] ?? [];
              const lastMsg = msgs[msgs.length - 1];
              const { color, label } = d.category ? categoryTypeConfig[d.category] : {};

              return (
                <Paper
                  key={id}
                  withBorder
                  radius="md"
                  onClick={() => openDialog(id)}
                  style={{ cursor: 'pointer', padding: 12, background: isActive ? 'var(--mantine-color-gray-1)' : undefined }}
                >
                  <Group justify="space-between" align="start">
                    <Group>
                      <div>
                        <Group justify="space-between" w={300}>
                          <Text fw={600}>Обращение #{id}</Text>
                          {isAdmin && color && label && <Badge color={color}>{label}</Badge>}
                        </Group>
                        <Text size="sm" lineClamp={1} c="dimmed">
                          {lastMsg?.text || '—'}
                        </Text>
                        <Group gap={8} mt={6}>
                          <Text size="xs" c="dimmed">{formatTimeISO(lastMsg?.timestamp)}</Text>
                        </Group>
                      </div>
                    </Group>
                  </Group>
                </Paper>
              );
            })}

            {!loading && visibleDialogs.length === 0 && (
              <Text c="dimmed" ta="center" py="lg">Ничего не найдено</Text>
            )}
            {loading && <Text c="dimmed" ta="center" py="lg">Загрузка…</Text>}
          </Stack>
        </ScrollArea>
      </Paper>

      <div className={styles.chatPane}>
        {activeDialog ? (
          <Chat
              messages={activeMessages}
              onSend={handleSend}
              title={`${isAdmin ? 'Чат с пользователем' : 'Обращение'} #${activeDialog.id}`}
              category={isAdmin ? activeDialog.category : undefined}
              placeholder="Напишите сообщение…"
          />
        ) : (
          <Paper withBorder radius="lg" className={styles.emptyState}>
            <Stack align="center">
              <Text c="dimmed">Выберите обращение слева, чтобы открыть переписку</Text>
              {!isAdmin && (
                <Button leftSection={<IconPlus size={16} />} onClick={addDialog}>
                  Новое обращение
                </Button>
              )}
            </Stack>
          </Paper>
        )}
      </div>
    </div>
  );
};
