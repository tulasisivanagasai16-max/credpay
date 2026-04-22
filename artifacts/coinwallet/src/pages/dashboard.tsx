import { Link } from "wouter";
import { 
  useGetWalletSummary, 
  useGetMe, 
  useGetSession 
} from "@workspace/api-client-react";
import { formatInr } from "@/lib/format";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowDownRight, 
  ArrowUpRight, 
  CreditCard, 
  Activity,
  PlusCircle,
  Send
} from "lucide-react";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: summary, isLoading: summaryLoading } = useGetWalletSummary();
  const { data: me, isLoading: meLoading } = useGetMe();

  const limitUsedPercent = summary ? (summary.todayPayoutInr / summary.dailyLimitInr) * 100 : 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, {meLoading ? <Skeleton className="h-4 w-24 inline-block align-middle" /> : <span className="font-medium text-foreground">{me?.name}</span>}
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/add-money">
            <Button className="font-medium" variant="outline">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Money
            </Button>
          </Link>
          <Link href="/send">
            <Button className="font-medium">
              <Send className="mr-2 h-4 w-4" />
              Send Money
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Balance Hero */}
      <Card className="bg-primary text-primary-foreground border-none shadow-xl overflow-hidden relative">
        <div className="absolute top-0 right-0 p-16 opacity-5 pointer-events-none">
          <svg viewBox="0 0 200 200" className="w-64 h-64" xmlns="http://www.w3.org/2000/svg">
            <path fill="currentColor" d="M44.7,-76.4C58.8,-69.2,71.8,-59.1,79.6,-46.8C87.4,-34.5,90,-20,89.5,-6.1C89,7.8,85.4,21.1,78.5,32.7C71.6,44.3,61.4,54.2,49.5,61.8C37.6,69.4,24.1,74.7,10.2,77.3C-3.7,79.9,-18,79.8,-30.9,74.5C-43.8,69.2,-55.3,58.8,-65.2,47.1C-75.1,35.4,-83.4,22.4,-86.3,8.3C-89.2,-5.8,-86.7,-21,-79.8,-33.5C-72.9,-46,-61.6,-55.8,-49,-63.5C-36.4,-71.2,-22.5,-76.8,-7.4,-79.7C7.7,-82.6,25.4,-82.8,44.7,-76.4Z" transform="translate(100 100)" />
          </svg>
        </div>
        <CardContent className="p-8 relative z-10">
          <div className="flex flex-col gap-2">
            <span className="text-primary-foreground/80 font-medium tracking-wide uppercase text-sm">Total Balance</span>
            {summaryLoading ? (
              <Skeleton className="h-14 w-48 bg-primary-foreground/20" />
            ) : (
              <div className="text-5xl md:text-6xl font-bold tracking-tight">
                {summary ? formatInr(summary.balanceInr) : '₹0.00'}
              </div>
            )}
            <div className="flex items-center gap-2 mt-4 text-primary-foreground/90 text-sm">
              <span className="flex h-2 w-2 rounded-full bg-green-400"></span>
              Ledger synchronized and up to date
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Added Today</CardTitle>
            <ArrowDownRight className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatInr(summary?.todayLoadedInr || 0)}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Paid Out Today</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatInr(summary?.todayPayoutInr || 0)}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Daily Limit Usage</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <>
                <div className="text-2xl font-bold">{Math.round(limitUsedPercent)}%</div>
                <Progress value={limitUsedPercent} className="h-2 mt-3" />
                <p className="text-xs text-muted-foreground mt-2">
                  {formatInr(summary?.todayPayoutInr || 0)} / {formatInr(summary?.dailyLimitInr || 0)}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Your latest ledger activity</CardDescription>
          </div>
          <Link href="/transactions">
            <Button variant="ghost" size="sm" className="text-primary font-medium">View All</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {summaryLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : summary?.recentTransactions?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg bg-muted/20">
              <CreditCard className="mx-auto h-8 w-8 mb-3 opacity-50" />
              <p className="font-medium">No transactions yet</p>
              <p className="text-sm mt-1">Load money to get started</p>
            </div>
          ) : (
            <div className="space-y-1">
              {summary?.recentTransactions.slice(0, 5).map((tx) => (
                <Link key={tx.id} href={`/transactions/${tx.id}`}>
                  <div className="flex items-center justify-between p-4 hover:bg-muted/50 rounded-lg cursor-pointer transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        tx.type === 'LOAD' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 
                        tx.type === 'PAYOUT' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 
                        'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                      }`}>
                        {tx.type === 'LOAD' ? <ArrowDownRight size={18} /> : 
                         tx.type === 'PAYOUT' ? <ArrowUpRight size={18} /> : 
                         <Activity size={18} />}
                      </div>
                      <div>
                        <p className="font-medium group-hover:text-primary transition-colors">
                          {tx.type === 'LOAD' ? 'Added Money' : 
                           tx.type === 'PAYOUT' ? 'Sent Money' : 
                           tx.type === 'FEE' ? 'Fee' : tx.type}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <span>{format(new Date(tx.createdAt), 'MMM d, h:mm a')}</span>
                          <span>•</span>
                          <StatusBadge status={tx.status} />
                        </div>
                      </div>
                    </div>
                    <div className={`font-bold ${
                      tx.type === 'LOAD' ? 'text-green-600 dark:text-green-400' : 'text-foreground'
                    }`}>
                      {tx.type === 'LOAD' ? '+' : '-'}{formatInr(tx.amountInr)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
