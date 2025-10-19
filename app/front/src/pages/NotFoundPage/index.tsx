import { Button, Container, Stack, Title } from "@mantine/core";
import { useNavigate } from "react-router-dom";

const NotFoundPage = () => {
  const navigate = useNavigate();
  return (
    <Container fluid h={"100vh"}>
      <Stack justify="center" align="center" gap="sm" h="100%">
        <Title>404</Title>
        <Button onClick={() => navigate("/chat")} color="gray">
          Вернуться на главную
        </Button>
      </Stack>
    </Container>
  );
};

export default NotFoundPage;
