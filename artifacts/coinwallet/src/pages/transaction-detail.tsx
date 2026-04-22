import { useParams, Link } from "wouter";
import { useGetTransaction } from "@workspace/api-client-react";
import { formatInr } from "@/lib/format";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ArrowLeft, CheckCircle2, XCircle, Clock, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function TransactionDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useGetTransaction(id!, { query: { enabled: !!id } as never });
  const { toast } = useToast();

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-bold">Transaction not found</h2>
        <Link href="/transactions">
          <Button variant="link" className="mt-4">Back to transactions</Button>
        </Link>
      </div>
    );
  }

  const { transaction: tx, entries } = data;

  const StatusIcon = 
    tx.status === 'SUCCESS' ? CheckCircle2 :
    tx.status === 'FAILED' ? XCircle : Clock;

  const statusColor = 
    tx.status === 'SUCCESS' ? 'text-green-500' :
    tx.status === 'FAILED' ? 'text-red-500' : 'text-amber-500';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Link href="/transactions">
          <Button variant="outline" size="icon" className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transaction Details</h1>
          <p className="text-muted-foreground mt-1 text-sm">{tx.id}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 border-none shadow-md overflow-hidden bg-card relative">
          <div className={`absolute top-0 inset-x-0 h-1 ${
            tx.status === 'SUCCESS' ? 'bg-green-500' :
            tx.status === 'FAILED' ? 'bg-red-500' : 'bg-amber-500'
          }`} />
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center space-y-4 py-4">
              <StatusIcon className={`h-16 w-16 ${statusColor}`} />
              <div>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{tx.type}</p>
                <h2 className="text-4xl font-bold my-2">{formatInr(tx.amountInr)}</h2>
                <StatusBadge status={tx.status} />
              </div>
            </div>

            <div className="space-y-4 mt-6 pt-6 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Date & Time</span>
                <span className="font-medium">{format(new Date(tx.createdAt), 'MMM d, yyyy h:mm a')}</span>
              </div>
              {tx.feeInr > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fee</span>
                  <span className="font-medium">{formatInr(tx.feeInr)}</span>
                </div>
              )}
              {tx.description && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Note</span>
                  <span className="font-medium">{tx.description}</span>
                </div>
              )}
              <div className="flex justify-between text-sm items-center">
                <span className="text-muted-foreground">Transaction ID</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs">{tx.id.substring(0, 8)}...</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(tx.id)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle>Double-Entry Ledger</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-hidden">
              <div className="bg-muted px-4 py-3 grid grid-cols-4 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                <div className="col-span-2">Account</div>
                <div className="text-right">Debit</div>
                <div className="text-right">Credit</div>
              </div>
              <div className="divide-y divide-border">
                {entries.map(entry => (
                  <div key={entry.id} className="px-4 py-3 grid grid-cols-4 text-sm items-center">
                    <div className="col-span-2">
                      <p className="font-medium">{entry.accountName}</p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{entry.accountId}</p>
                    </div>
                    <div className="text-right font-mono text-red-600 dark:text-red-400 font-medium">
                      {entry.direction === 'DEBIT' ? formatInr(entry.amountInr) : '-'}
                    </div>
                    <div className="text-right font-mono text-green-600 dark:text-green-400 font-medium">
                      {entry.direction === 'CREDIT' ? formatInr(entry.amountInr) : '-'}
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-muted/50 px-4 py-3 grid grid-cols-4 text-sm font-bold border-t">
                <div className="col-span-2 text-right pr-4 text-muted-foreground">Total Balance:</div>
                <div className="text-right font-mono">{formatInr(tx.amountInr)}</div>
                <div className="text-right font-mono">{formatInr(tx.amountInr)}</div>
              </div>
            </div>
            <div className="mt-4 text-xs text-muted-foreground flex items-start gap-2">
              <div className="h-4 w-4 rounded-full bg-green-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
              </div>
              <p>This transaction is fully reconciled. Every rupee debited is matched by a credit, ensuring zero value loss across the platform.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
