import { zodResolver } from "@hookform/resolvers/zod";
import {
  Anchor,
  Button,
  Group,
  Paper,
  PasswordInput,
  Stack,
  TextInput,
  Title,
  Alert,
} from "@mantine/core";
import { observer } from "mobx-react-lite";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "@/entities/user/model/user.context";
import { RoutePaths } from "@app/router/constants";
import { AuthValuesSchema, AuthValuesType } from "@/shared/validation";

const AuthPage = observer(() => {
  const userStore = useUserStore();
  const navigate = useNavigate();
  const [loginError, setLoginError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AuthValuesType>({
    resolver: zodResolver(AuthValuesSchema),
    defaultValues: { login: "", password: "" },
    mode: "onTouched",
  });

  const onSubmit = async (values: AuthValuesType) => {
    setLoginError(null);
    const success = await userStore.login(values.login, values.password);
    if (success) {
      navigate(RoutePaths.CHAT);
    } else {
      setLoginError("Неправильный логин или пароль");
    }
  };

  return (
    <Group justify="center" align="center" h="100%" w={"100%"}>
      <Paper
        shadow="xl"
        radius="md"
        p={{ base: 24, sm: 40 }}
        w={{ base: 320, sm: 420 }}
        withBorder
        bg="rgba(255,255,255,0.85)"
        style={{ backdropFilter: "blur(6px)" }}
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Stack gap="md">
            <Title order={2} ta="center">
              Вход
            </Title>

            {loginError && (
              <Alert
                color="red"
                title="Ошибка авторизации"
                withCloseButton
                onClose={() => setLoginError(null)}
              >
                {loginError}
              </Alert>
            )}

            <TextInput
              label="Логин"
              placeholder="username"
              error={errors.login?.message}
              withAsterisk
              {...register("login")}
            />

            <PasswordInput
              label="Пароль"
              placeholder="••••••••"
              error={errors.password?.message}
              withAsterisk
              {...register("password")}
            />

            <Group justify="space-between" mt={-8}>
              <Anchor
                size="sm"
                onClick={() => console.log("Переход на забыли пароль")}
              >
                Забыли пароль?
              </Anchor>
            </Group>

            <Button type="submit" loading={isSubmitting} fullWidth radius="md" color="gray">
              Войти
            </Button>
          </Stack>
        </form>
      </Paper>
    </Group>
  );
});

export default AuthPage;
