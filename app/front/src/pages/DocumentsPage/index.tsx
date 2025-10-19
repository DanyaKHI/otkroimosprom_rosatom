import { useMemo, useState } from "react";
import {
  Container,
  Title,
  Button,
  TextInput,
  Modal,
  Card,
  Badge,
  ScrollArea,
  Group,
  Stack,
  ThemeIcon,
  Text,
} from "@mantine/core";
import { Dropzone, FileWithPath, MIME_TYPES } from "@mantine/dropzone";
import {
  IconFile as IconFileGeneric,
  IconFileText,
  IconFileSpreadsheet,
  IconFileZip,
  IconMusic,
  IconCode,
  IconSearch,
  IconPlus,
  IconUpload,
} from "@tabler/icons-react";

// ---------- Types ----------

type DocType =
  | "pdf"
  | "docx"
  | "pptx"
  | "xlsx"
  | "txt"
  | "md"
  | "csv"
  | "png"
  | "jpg"
  | "gif"
  | "svg"
  | "zip"
  | "mp4"
  | "mp3"
  | "wav"
  | "json"
  | "xml"
  | "html"
  | "js"
  | "ts";

interface DocumentItem {
  id: string;
  name: string;
  type: DocType;
  size: number; // bytes
  modifiedAt: string; // ISO date
}

// ---------- Helpers ----------

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function extToType(ext: string): DocType {
  const e = ext.toLowerCase().replace(".", "");
  const map: Partial<Record<string, DocType>> = {
    pdf: "pdf",
    doc: "docx",
    docx: "docx",
    ppt: "pptx",
    pptx: "pptx",
    xls: "xlsx",
    xlsx: "xlsx",
    csv: "csv",
    txt: "txt",
    md: "md",
    png: "png",
    jpg: "jpg",
    jpeg: "jpg",
    gif: "gif",
    svg: "svg",
    zip: "zip",
    mp4: "mp4",
    mp3: "mp3",
    wav: "wav",
    json: "json",
    xml: "xml",
    html: "html",
    js: "js",
    ts: "ts",
  };
  return (map[e] as DocType) || "txt";
}

function TypeIcon({ type }: { type: DocType }) {
  const size = 18;
  switch (type) {
    case "pdf":
    case "docx":
    case "txt":
    case "md":
    case "html":
      return <IconFileText size={size} />;
    case "xlsx":
    case "csv":
      return <IconFileSpreadsheet size={size} />;
    case "png":
    case "jpg":
    case "gif":
    case "svg":
      return <IconFileText size={size} />;
    case "zip":
      return <IconFileZip size={size} />;
    case "mp4":
      return <IconFileText size={size} />;
    case "mp3":
    case "wav":
      return <IconMusic size={size} />;
    case "js":
    case "ts":
    case "json":
    case "xml":
      return <IconCode size={size} />;
    default:
      return <IconFileGeneric size={size} />;
  }
}

const initialDocs: DocumentItem[] = [
  { id: "1", name: "AWS", type: "pdf", size: 1_245_821, modifiedAt: "2025-10-19T11:45:00Z" },
  { id: "2", name: "1С", type: "docx", size: 287_322, modifiedAt: "2025-10-19T08:12:00Z" },
  { id: "3", name: "Slice2", type: "xlsx", size: 8_102_554, modifiedAt: "2025-10-19T09:30:00Z" },
  { id: "4", name: "Slice3", type: "xlsx", size: 532_881, modifiedAt: "2025-10-19T15:10:00Z" },
  { id: "5", name: "notes", type: "txt", size: 2_341, modifiedAt: "2025-10-19T19:03:00Z" },
  { id: "6", name: "notes", type: "txt", size: 8, modifiedAt: "2025-10-19T10:00:00Z" },
  { id: "7", name: "экспорт_клиентов", type: "csv", size: 124_551, modifiedAt: "2025-10-19T07:50:00Z" },
  { id: "8", name: "бух.учет", type: "docx", size: 2_422_998, modifiedAt: "2025-10-19T12:40:00Z" },
  { id: "12", name: "архив", type: "txt", size: 42_811_992, modifiedAt: "2025-10-19T16:00:00Z" },
  { id: "14", name: "подкаст", type: "txt", size: 12_455_821, modifiedAt: "2025-10-19T06:24:00Z" },
  { id: "15", name: "озвучка", type: "wav", size: 22_455_821, modifiedAt: "2025-10-19T12:12:00Z" },
  { id: "16", name: "config", type: "json", size: 9_112, modifiedAt: "2025-10-19T11:11:00Z" },
  { id: "17", name: "layout", type: "xml", size: 19_220, modifiedAt: "2025-10-19T10:10:00Z" },
  { id: "18", name: "index", type: "html", size: 42_552, modifiedAt: "2025-10-19T01:01:00Z" },
  { id: "19", name: "app", type: "js", size: 122_310, modifiedAt: "2025-07-22T22:22:00Z" },
  { id: "20", name: "main", type: "ts", size: 88_003, modifiedAt: "2025-09-30T14:14:00Z" },
];

export default function DocumentsPage() {
  const [query, setQuery] = useState("");
  const [docs, setDocs] = useState<DocumentItem[]>(initialDocs);
  const [opened, setOpened] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((d) =>
      [d.name.toLowerCase(), d.type.toLowerCase()].some((f) => f.includes(q))
    );
  }, [docs, query]);

  function handleFiles(files: FileWithPath[]) {
    if (!files?.length) return;
    const now = new Date().toISOString();
    const added: DocumentItem[] = files.map((f, i) => ({
      id: `${Date.now()}_${i}`,
      name: (f.name || "file").replace(/\.[^.]+$/, ""),
      type: extToType((f.name || "").split(".").pop() || ""),
      size: (f as File).size ?? 0,
      modifiedAt: now,
    }));
    setDocs((prev) => [...added, ...prev]);
  }

  return (
    <Container size="lg" py="lg">
      {/* Header */}
      <Group justify="space-between" mb="md" wrap="nowrap">
        <Title order={2}>Документы</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setOpened(true)}>
          Добавить
        </Button>
      </Group>

      {/* Search */}
      <TextInput
        placeholder="Поиск по названию или формату..."
        leftSection={<IconSearch size={16} />}
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        mb="md"
      />

      {/* List */}
      <Card withBorder padding="xs">
        <ScrollArea h={480} type="hover" offsetScrollbars>
          <Stack gap={0}
            style={{ listStyle: "none" }}>
            {filtered.length === 0 && (
              <Text ta="center" c="dimmed" py="md" size="sm">
                Ничего не найдено.
              </Text>
            )}
            {filtered.map((d) => (
              <Group key={d.id} p="md" gap="md" wrap="nowrap"
                     style={{ borderBottom: "1px solid var(--mantine-color-gray-3)" }}>
                <ThemeIcon variant="light" size={40} radius="md">
                  <TypeIcon type={d.type} />
                </ThemeIcon>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Group gap="xs" wrap="wrap">
                    <Text truncate fw={500} size="sm">{d.name}</Text>
                    <Badge variant="light" radius="sm">
                      {d.type}
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(d.modifiedAt))}
                    {" · "}
                    {formatBytes(d.size)}
                  </Text>
                </div>
                <Button variant="light" size="compact-md">Открыть</Button>
              </Group>
            ))}
          </Stack>
        </ScrollArea>
      </Card>

      {/* Add Modal with Dropzone */}
      <Modal opened={opened} onClose={() => setOpened(false)} title="Добавить документы" centered>
        <Text size="sm" c="dimmed" mb="xs">
          Перетащите файлы в область ниже или нажмите, чтобы выбрать.
        </Text>
        <Dropzone
          onDrop={(files) => {
            handleFiles(files);
            setOpened(false);
          }}
          onReject={() => {}}
          maxSize={1024 * 1024 * 1024}
          accept={[
            MIME_TYPES.pdf,
            MIME_TYPES.doc,
            MIME_TYPES.docx,
            MIME_TYPES.ppt,
            MIME_TYPES.pptx,
            MIME_TYPES.xls,
            MIME_TYPES.xlsx,
            MIME_TYPES.csv,
            MIME_TYPES.jpeg,
            MIME_TYPES.png,
            MIME_TYPES.svg,
            MIME_TYPES.gif,
            MIME_TYPES.zip,
            MIME_TYPES.mp4,
          ]}
          multiple
        >
          <Group justify="center" gap="xs" mih={160} style={{ pointerEvents: "none" }}>
            <IconUpload size={22} />
            <div>
              <Text ta="center" fw={500}>Перетащите файлы сюда</Text>
              <Text ta="center" size="sm" c="dimmed">или нажмите, чтобы выбрать</Text>
            </div>
          </Group>
        </Dropzone>
      </Modal>
    </Container>
  );
}