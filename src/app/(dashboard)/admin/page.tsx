import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, ShieldCheck, Users, UsersRound, TrendingUp } from "lucide-react";

const adminLinks = [
  {
    title: "Employees",
    description: "Add, edit, and manage staff records.",
    href: "/employees",
    icon: Users,
  },
  {
    title: "Group",
    description: "Organize teams and assign members.",
    href: "/team-management",
    icon: UsersRound,
  },
  {
    title: "Employee Performance",
    description: "Review performance and attendance insights.",
    href: "/employee-performance",
    icon: TrendingUp,
  },
  {
    title: "Security",
    description: "Check login and logout activity.",
    href: "/security",
    icon: ShieldCheck,
  },
  {
    title: "Clients",
    description: "Manage client records and CRM access.",
    href: "/clients",
    icon: Building2,
  },
];

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-muted-foreground">
          Central place for admin-only management screens.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {adminLinks.map((item) => {
          const Icon = item.icon;

          return (
            <Card key={item.href} className="border-slate-200 shadow-sm">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <CardTitle className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-sky-600" />
                      {item.title}
                    </CardTitle>
                    <CardDescription>{item.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href={item.href}>Open {item.title}</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
