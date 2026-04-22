import { useGetMe, useGetSession } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { LogOut, User, Mail, Shield, Calendar } from "lucide-react";
import { format } from "date-fns";
import { formatInrCompact } from "@/lib/format";

export default function Settings() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: me, isLoading: meLoading } = useGetMe();
  const { data: session } = useGetSession();

  const handleSignOut = () => {
    // Demo implementation just clears cache and redirects to login
    queryClient.clear();
    setLocation("/login");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-6">
            {meLoading ? (
              <Skeleton className="h-20 w-20 rounded-full" />
            ) : (
              <Avatar className="h-20 w-20 border-2 border-primary/20">
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                  {me?.name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
            )}
            <div className="space-y-1">
              {meLoading ? (
                <>
                  <Skeleton className="h-6 w-40 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </>
              ) : (
                <>
                  <h3 className="text-2xl font-bold">{me?.name}</h3>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>{me?.email}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 pt-6 border-t">
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Shield className="h-4 w-4" /> KYC Status
              </span>
              {meLoading ? <Skeleton className="h-6 w-20" /> : <StatusBadge status={me?.kycStatus || 'PENDING'} />}
            </div>
            
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <User className="h-4 w-4" /> Account Role
              </span>
              <div className="font-medium capitalize">{me?.role}</div>
            </div>

            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Daily Limit</span>
              <div className="font-mono font-medium">{meLoading ? <Skeleton className="h-5 w-20" /> : formatInrCompact(me?.dailyLimitInr || 0)}</div>
            </div>

            <div className="space-y-1">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="h-4 w-4" /> Member Since
              </span>
              <div className="font-medium">
                {meLoading ? <Skeleton className="h-5 w-24" /> : format(new Date(me?.createdAt || Date.now()), 'MMM d, yyyy')}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session Information</CardTitle>
          <CardDescription>Current active session details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Session ID</span>
              <span>{session?.id.substring(0, 8)}...</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Role</span>
              <span>{session?.role}</span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/30 pt-6 border-t">
          <Button variant="destructive" onClick={handleSignOut} className="w-full sm:w-auto">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
