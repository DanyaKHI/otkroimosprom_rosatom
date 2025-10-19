import React, { useEffect, useRef, useState } from 'react';
import { Paper, Group, Text, ActionIcon, Textarea, ScrollArea, Divider, Badge } from '@mantine/core';
import { IconSend } from '@tabler/icons-react';
import styles from './Chat.module.scss';
import { MessageView } from '@/shared/api/generated';
import { useUserStore } from '@/entities/user/model/user.context';

interface ChatProps {
  messages: MessageView[];
  onSend?: (text: string) => void | Promise<void>;
  placeholder?: string;
  title?: string;
  category?: string | null;
}

function formatTime(ts: Date) {
  if (!ts) return '';
  const d = ts instanceof Date ? ts : new Date(ts as any);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function useAutoScroll(deps: React.DependencyList = []) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, deps);
  return viewportRef;
}

const isFromCurrentUser = (messageView: MessageView, userName: string|undefined) => {
  return messageView.user === userName;
}

const categoryTypeConfig: Record<
  any,
  { color: string; label: string }
> = {
  IT: { color: "blue", label: "IT" },
  AD: { color: "green", label: "Бух" },
  HR: { color: "purple", label: "HR" },
};

export const Chat = ({
  messages,
  onSend,
  placeholder = 'Напишите сообщение…',
  title = 'Чат',
  category
}: ChatProps) => {
  const {user} = useUserStore();
  const [input, setInput] = useState('');
  const viewportRef = useAutoScroll([messages.length]);
  const { color, label } = category ? categoryTypeConfig[category] : {};

  const canSend = input.trim().length > 0;

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    await onSend?.(text);
  };

  return (
    <Paper withBorder radius="xl" className={styles.root}>
      <Group className={styles.head} px="md" py="sm" justify="space-between">
        <Text fw={600}>{title}</Text>
        {color && label && <Badge color={color}>{label}</Badge>}
      </Group>

      <Divider className={styles.divider} />

      <ScrollArea className={styles.scroll} viewportRef={viewportRef} type="scroll" scrollbarSize={3} offsetScrollbars>
        <div className={styles.list}>
          {messages.map((m) => {
            const isUserSide = isFromCurrentUser(m, user?.name);
            const name = isUserSide ? 'Вы' : m.user;

            return (
              <div key={String(m.id)} className={`${styles.msg} ${isUserSide ? styles.msgUser : styles.msgBot}`}>
                <div className={styles.bubble}>
                  <div className={styles.meta}>
                    <Text size="xs" c="dimmed" className={styles.name}>{name}</Text>
                    <Text size="xs" c="dimmed" className={styles.time}>{formatTime(m.timestamp)}</Text>
                  </div>
                  <div className={styles.body}>{m.text}</div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <Divider className={styles.divider} />

      <div className={styles.inputRow}>
        <Textarea
          autosize
          minRows={1}
          maxRows={6}
          value={input}
          onChange={(e) => setInput(e.currentTarget.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          aria-label="Ввод сообщения"
        />
        <ActionIcon size="lg" radius="md" variant="filled" onClick={handleSend} disabled={!canSend} aria-label="Send">
          <IconSend size={16} />
        </ActionIcon>
      </div>
    </Paper>
  );
};
