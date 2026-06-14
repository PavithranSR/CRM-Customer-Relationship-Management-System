import { redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SecurityPageProps {
  searchParams: Promise<{
    action?: "all" | "LOGIN" | "LOGOUT";
    date?: string;
  }>;
}

export default async function SecurityPage({ searchParams }: SecurityPageProps) {
  const params = await searchParams;
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const selectedAction = params.action ?? "all";
  const selectedDate = params.date;

  const dateWhere = selectedDate
    ? {
        gte: new Date(`${selectedDate}T00:00:00.000Z`),
        lte: new Date(`${selectedDate}T23:59:59.999Z`),
      }
    : undefined;

  const logs = await db.activityLog.findMany({
    where: {
      action:
        selectedAction === "all"
          ? { in: ["LOGIN", "LOGOUT"] }
          : selectedAction,
      ...(dateWhere && { createdAt: dateWhere }),
    },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      createdBy: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Security</h1>
        <p className="text-muted-foreground">Login and logout history for all users</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>Action</Label>
              <Select name="action" defaultValue={selectedAction}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Login + Logout" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Login + Logout</SelectItem>
                  <SelectItem value="LOGIN">Login</SelectItem>
                  <SelectItem value="LOGOUT">Logout</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" name="date" defaultValue={selectedDate} className="w-44" />
            </div>
            <Button type="submit">Filter</Button>
            <Button type="button" variant="outline" asChild>
              <a href="/security">Reset</a>
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Authentication History</CardTitle>
          <CardDescription>Latest Login and Logout events across all users</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No login/logout records found.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const actor = log.user ?? log.createdBy;
                    const actionLabel = log.action === "LOGIN" ? "Login" : "Logout";
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">
                          {actor?.name ?? "Unknown user"}
                        </TableCell>
                        <TableCell>{actor?.email ?? "No email"}</TableCell>
                        <TableCell>{actor?.role ?? "Unknown role"}</TableCell>
                        <TableCell>
                          <Badge variant={log.action === "LOGIN" ? "default" : "secondary"}>
                            {actionLabel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(log.createdAt), "MMM d, yyyy h:mm a")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

