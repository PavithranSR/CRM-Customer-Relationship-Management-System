"use server";

import { auth, signIn, signOut } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { db, isDatabaseConfigured } from "@/lib/db";
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  updateEmailSchema,
} from "@/lib/validations/auth.schema";
import { CredentialSystemError, getUserFromCredentials } from "@/lib/auth.config";
import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";

const loginServiceErrorMessage =
  "Login service is temporarily unavailable. Please check database connectivity and try again.";

export async function login(formData: FormData) {
  const validatedFields = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validatedFields.success) {
    return { error: "Invalid fields" };
  }

  const email = validatedFields.data.email.trim().toLowerCase();
  const { password } = validatedFields.data;

  const authenticatedUser = await getUserFromCredentials({ email, password }).catch((error) => {
    if (error instanceof CredentialSystemError) {
      return { systemError: true } as const;
    }
    throw error;
  });

  if (authenticatedUser && "systemError" in authenticatedUser) {
    return { error: loginServiceErrorMessage };
  }

  if (!authenticatedUser) {
    return { error: "Invalid credentials" };
  }

  try {
    const signInResult = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (signInResult && typeof signInResult === "object" && "error" in signInResult && signInResult.error) {
      return { error: "Invalid credentials" };
    }

    const user = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (user) {
      await db.activityLog.create({
        data: {
          action: "LOGIN",
          entityType: "auth",
          entityId: user.id,
          userId: user.id,
          createdById: user.id,
          metadata: { method: "credentials" },
        },
      });
    }

    return { success: true };
  } catch (error) {
    if (error instanceof CredentialSystemError) {
      return { error: loginServiceErrorMessage };
    }

    const authType =
      error instanceof AuthError
        ? error.type
        : typeof error === "object" &&
            error !== null &&
            "type" in error &&
            typeof (error as { type?: unknown }).type === "string"
          ? (error as { type: string }).type
          : undefined;

    if (authType === "CredentialsSignin") {
      return { error: "Invalid credentials" };
    }

    if (error instanceof AuthError) {
      return { error: "Something went wrong" };
    }

    throw error;
  }
}

export async function register(formData: FormData) {
  const validatedFields = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors };
  }

  if (!isDatabaseConfigured) {
    return { error: loginServiceErrorMessage };
  }

  const name = validatedFields.data.name.trim();
  const email = validatedFields.data.email.trim().toLowerCase();
  const { password } = validatedFields.data;

  try {
    const existingUser = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return { error: "Email is already registered" };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "EMPLOYEE",
        isActive: true,
      },
      select: { id: true },
    });

    return { success: true };
  } catch (error) {
    console.error("Registration failed:", error);
    return { error: loginServiceErrorMessage };
  }
}

export async function logout() {
  const session = await auth();

  if (session?.user?.id) {
    try {
      const existingUser = await db.user.findUnique({
        where: { id: session.user.id },
        select: { id: true },
      });

      if (existingUser) {
        await db.activityLog.create({
          data: {
            action: "LOGOUT",
            entityType: "auth",
            entityId: existingUser.id,
            userId: existingUser.id,
            createdById: existingUser.id,
          },
        });
      }
    } catch (error) {
      // Logging must not block sign out.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003")) {
        throw error;
      }
    }
  }

  await signOut({ redirectTo: "/login" });
  revalidatePath("/");
}

export async function updateCurrentUserEmail(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  const validatedFields = updateEmailSchema.safeParse({
    email: formData.get("email"),
  });

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors.email?.[0] ?? "Invalid email" };
  }

  const email = validatedFields.data.email.trim().toLowerCase();

  const existingUser = await db.user.findFirst({
    where: {
      email,
      NOT: { id: session.user.id },
    },
    select: { id: true },
  });

  if (existingUser) {
    return { error: "Email already in use" };
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { email },
  });

  revalidatePath("/profile");
  revalidatePath("/settings");
  revalidatePath("/dashboard");

  return { success: true };
}

export async function changeCurrentUserPassword(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  const validatedFields = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!validatedFields.success) {
    const flattened = validatedFields.error.flatten().fieldErrors;
    return {
      error:
        flattened.currentPassword?.[0] ||
        flattened.newPassword?.[0] ||
        flattened.confirmPassword?.[0] ||
        "Invalid password data",
    };
  }

  const { currentPassword, newPassword } = validatedFields.data;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, password: true },
  });

  if (!user) {
    return { error: "User not found" };
  }

  const passwordMatches = await bcrypt.compare(currentPassword, user.password);
  if (!passwordMatches) {
    return { error: "Current password is incorrect" };
  }

  const newPasswordMatchesCurrent = await bcrypt.compare(newPassword, user.password);
  if (newPasswordMatchesCurrent) {
    return { error: "New password must be different from current password" };
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await db.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  revalidatePath("/settings");
  revalidatePath("/profile");

  return { success: true };
}
