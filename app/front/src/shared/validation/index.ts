import { z } from "zod";

export const AuthValuesSchema = z.object({
  login: z
    .string()
    .min(3, { message: "Минимум 3 символа" }),
  password: z.string().min(3, { message: "Минимум 3 символов" }),
});

export type AuthValuesType = z.infer<typeof AuthValuesSchema>;
