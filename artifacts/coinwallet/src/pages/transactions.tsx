import { useState } from "react";
import { Link } from "wouter";
import { useListTransactions } from "@workspace/api-client-react";
import { formatInr } from "@/lib/format";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Search, ArrowDownRight, ArrowUpRight, Activity } from "lucide-react";
import type { ListTransactionsType } from "@workspace/api-client-react/src/generated/api.schemas";

export default function Transactions() {
  const [typeFilter, setTypeFilter] = useState<ListTransactionsType | "ALL">("ALL");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useListTransactions({ 
    limit: 100, 
    type: typeFilter === "ALL" ? undefined : typeFilter 
  });

  const filteredTransactions = data?.items?.filter(tx => 
    tx.id.toLowerCase().includes(search.toLowerCase()) || 
    tx.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
        <p className="text-muted-foreground mt-1">View and search your complete ledger history</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by ID or description..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-[200px]">
          <Select value={typeFilter} onValueChange={(v: ListTransactionsType | "ALL") => setTypeFilter(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              <SelectItem value="LOAD">Added Money</SelectItem>
              <SelectItem value="PAYOUT">Sent Money</SelectItem>
              <SelectItem value="FEE">Fees</SelectItem>
              <SelectItem value="REFUND">Refunds</SelectItem>
              <SelectItem value="ADJUSTMENT">Adjustments</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : filteredTransactions?.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="font-medium">No transactions found</p>
              <p className="text-sm mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredTransactions?.map((tx) => (
                <Link key={tx.id} href={`/transactions/${tx.id}`}>
                  <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors group cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
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
                        <p className="text-sm text-muted-foreground truncate max-w-[200px] sm:max-w-md">
                          {tx.description || tx.id}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className={`font-bold ${
                        tx.type === 'LOAD' ? 'text-green-600 dark:text-green-400' : 'text-foreground'
                      }`}>
                        {tx.type === 'LOAD' ? '+' : '-'}{formatInr(tx.amountInr)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{format(new Date(tx.createdAt), 'MMM d, h:mm a')}</span>
                        <StatusBadge status={tx.status} />
                      </div>
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
