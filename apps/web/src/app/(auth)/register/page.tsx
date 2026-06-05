import { AuthPage } from "@/modules/auth";

interface PageProps {
  searchParams: Promise<{ redirect?: string }>;
}

export default async function RegisterPage({ searchParams }: PageProps) {
  const { redirect } = await searchParams;
  return <AuthPage mode="register" redirect={redirect} />;
}
