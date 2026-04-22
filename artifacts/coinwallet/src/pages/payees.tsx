import { useListPayees } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Users, Banknote, Smartphone, Plus } from "lucide-react";
import { format } from "date-fns";

export default function Payees() {
  const { data, isLoading } = useListPayees();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Saved Payees</h1>
          <p className="text-muted-foreground mt-1">Manage your beneficiaries for quick transfers</p>
        </div>
        <Link href="/send">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add New Payee
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : data?.items.length === 0 ? (
        <Card className="border-dashed border-2 bg-muted/10">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No saved payees</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">Save UPI IDs and Bank Accounts to make sending money faster and less prone to errors.</p>
            <Link href="/send">
              <Button>Add Your First Payee</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.items.map(payee => (
            <Card key={payee.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${payee.type === 'UPI' ? 'bg-primary/10 text-primary' : 'bg-secondary/20 text-secondary-foreground'}`}>
                    {payee.type === 'UPI' ? <Smartphone size={24} /> : <Banknote size={24} />}
                  </div>
                  <div className="px-2 py-1 text-xs font-semibold tracking-wider rounded-md bg-muted text-muted-foreground uppercase">
                    {payee.type}
                  </div>
                </div>
                <h3 className="font-bold text-lg mb-1">{payee.label}</h3>
                <p className="text-muted-foreground font-mono text-sm break-all">{payee.identifier}</p>
                {payee.ifsc && (
                  <p className="text-muted-foreground/80 font-mono text-xs mt-1">IFSC: {payee.ifsc}</p>
                )}
                <div className="mt-6 pt-4 border-t flex justify-between items-center text-xs text-muted-foreground">
                  <span>Added {format(new Date(payee.createdAt), 'MMM d, yyyy')}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
