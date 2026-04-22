import { useGetLedgerOverview, useGetRiskQueue } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatInr } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, Activity, CheckCircle, Landmark } from "lucide-react";
import { format } from "date-fns";

export default function Admin() {
  const { data: overview, isLoading: overviewLoading } = useGetLedgerOverview();
  const { data: risk, isLoading: riskLoading } = useGetRiskQueue();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Platform Ledger</h1>
        <p className="text-muted-foreground mt-1">Admin view of double-entry accounting balances and risk queue</p>
      </div>

      {overviewLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <Card className={`border-2 ${overview?.doubleEntryBalanced ? 'border-green-500/50 bg-green-50/20 dark:bg-green-950/10' : 'border-red-500/50 bg-red-50/20 dark:bg-red-950/10'}`}>
          <CardContent className="flex items-center justify-between p-6">
            <div className="flex items-center gap-4">
              {overview?.doubleEntryBalanced ? (
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              ) : (
                <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                  <Activity className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
              )}
              <div>
                <h3 className="text-xl font-bold">
                  {overview?.doubleEntryBalanced ? 'Ledger Balanced' : 'Ledger Out of Sync!'}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {overview?.doubleEntryBalanced 
                    ? 'Total assets match total liabilities across all accounts.' 
                    : 'CRITICAL: Asset and liability totals do not match. Halt operations.'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Total Platform Value</p>
              <p className="text-3xl font-bold font-mono">{formatInr((overview?.totalUserCoinsInr || 0) + (overview?.totalPlatformInr || 0) + (overview?.totalFeesInr || 0))}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">User Liabilities</CardTitle>
          </CardHeader>
          <CardContent>
            {overviewLoading ? <Skeleton className="h-8 w-32" /> : (
              <div className="text-2xl font-bold font-mono">{formatInr(overview?.totalUserCoinsInr || 0)}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Total balances in all user wallets</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Platform Treasury</CardTitle>
          </CardHeader>
          <CardContent>
            {overviewLoading ? <Skeleton className="h-8 w-32" /> : (
              <div className="text-2xl font-bold font-mono">{formatInr(overview?.totalPlatformInr || 0)}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Bank settlement account balance</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Fee Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            {overviewLoading ? <Skeleton className="h-8 w-32" /> : (
              <div className="text-2xl font-bold font-mono text-green-600 dark:text-green-400">{formatInr(overview?.totalFeesInr || 0)}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Realized revenue account</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5" />
              Chart of Accounts
            </CardTitle>
            <CardDescription>Live balances of system-level ledger accounts</CardDescription>
          </CardHeader>
          <CardContent>
            {overviewLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {overview?.accounts.map(acc => (
                  <div key={acc.accountId} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{acc.name}</p>
                      <div className="flex gap-2 items-center mt-1">
                        <Badge variant="outline" className="text-[10px] py-0 h-4">{acc.type}</Badge>
                        <span className="font-mono text-[10px] text-muted-foreground">{acc.accountId}</span>
                      </div>
                    </div>
                    <div className="font-mono font-medium">{formatInr(acc.balanceInr)}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
              <ShieldAlert className="h-5 w-5" />
              Risk Queue
            </CardTitle>
            <CardDescription>Suspicious activity requiring manual review</CardDescription>
          </CardHeader>
          <CardContent>
            {riskLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : risk?.items.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                <CheckCircle className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p>No active risk alerts</p>
              </div>
            ) : (
              <div className="space-y-3">
                {risk?.items.map(item => (
                  <div key={item.id} className="p-3 border rounded-lg bg-card flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-2 items-center">
                        <Badge className={`${
                          item.severity === 'HIGH' ? 'bg-red-500 hover:bg-red-600' :
                          item.severity === 'MEDIUM' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-500 hover:bg-blue-600'
                        }`}>
                          {item.severity}
                        </Badge>
                        <span className="text-xs font-bold text-muted-foreground uppercase">{item.kind}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{format(new Date(item.createdAt), 'MMM d, h:mm a')}</span>
                    </div>
                    <p className="text-sm font-medium">{item.message}</p>
                    <p className="text-xs text-muted-foreground font-mono">User: {item.userEmail}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
