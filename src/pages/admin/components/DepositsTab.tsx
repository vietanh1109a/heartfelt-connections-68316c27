import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Eye, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const PAGE_SIZE = 20;

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Chờ TT", variant: "secondary" },
  paid: { label: "Đã nạp", variant: "default" },
  expired: { label: "Hết hạn", variant: "destructive" },
  cancelled: { label: "Huỷ", variant: "outline" },
};

export function DepositsTab() {
  const [page, setPage] = useState(0);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("");
  const [filterUser, setFilterUser] = useState<string>("");
  const [viewPayload, setViewPayload] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-deposits-v2", page, filterStatus, filterDate, filterUser],
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Query deposits table (SePay flow)
      let depositsQuery = (supabase as any)
        .from("deposits")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (filterStatus !== "all") {
        depositsQuery = depositsQuery.eq("status", filterStatus);
      }
      if (filterDate) {
        depositsQuery = depositsQuery.gte("created_at", `${filterDate}T00:00:00`).lte("created_at", `${filterDate}T23:59:59`);
      }

      const { data: deposits, error, count } = await depositsQuery;
      if (error) throw error;

      // Fetch display names
      const userIds = [...new Set((deposits ?? []).map((d: any) => d.user_id))];
      let nameMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", userIds as string[]);
        nameMap = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name ?? "—"]));
      }

      let rows = (deposits ?? []).map((d: any) => ({
        ...d,
        display_name: nameMap.get(d.user_id) ?? "—",
      }));

      // Client-side filter by user name
      if (filterUser.trim()) {
        const q = filterUser.toLowerCase();
        rows = rows.filter((r: any) => r.display_name.toLowerCase().includes(q));
      }

      // Totals
      const totalPaid = rows
        .filter((r: any) => r.status === "paid")
        .reduce((s: number, r: any) => s + (r.amount ?? 0), 0);

      return { rows, total: count ?? 0, totalPaid };
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPaid = data?.totalPaid ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="bg-card border border-border/50 rounded-xl px-4 py-3">
          <p className="text-muted-foreground">Tổng giao dịch</p>
          <p className="text-xl font-bold text-foreground">{total}</p>
        </div>
        <div className="bg-card border border-border/50 rounded-xl px-4 py-3">
          <p className="text-muted-foreground">Đã nạp (trang này)</p>
          <p className="text-xl font-bold text-chart-2">+{totalPaid.toLocaleString("vi-VN")}đ</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {["all", "pending", "paid", "expired", "cancelled"].map((s) => (
          <button
            key={s}
            onClick={() => { setFilterStatus(s); setPage(0); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              filterStatus === s
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary/40 text-muted-foreground border-border/40 hover:border-primary/40"
            }`}
          >
            {s === "all" ? "Tất cả" : STATUS_BADGE[s]?.label ?? s}
          </button>
        ))}
        <Input
          placeholder="Lọc theo ngày (YYYY-MM-DD)"
          value={filterDate}
          onChange={(e) => { setFilterDate(e.target.value); setPage(0); }}
          className="w-44 h-8 text-xs"
        />
        <Input
          placeholder="Tên người dùng"
          value={filterUser}
          onChange={(e) => { setFilterUser(e.target.value); setPage(0); }}
          className="w-36 h-8 text-xs"
        />
        {(filterDate || filterUser) && (
          <button onClick={() => { setFilterDate(""); setFilterUser(""); }} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Người dùng</TableHead>
              <TableHead>Mã nạp</TableHead>
              <TableHead className="text-right">Số tiền</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>SePay TX</TableHead>
              <TableHead>Thời gian</TableHead>
              <TableHead className="w-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Đang tải...</TableCell>
              </TableRow>
            ) : !rows.length ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Chưa có giao dịch nào</TableCell>
              </TableRow>
            ) : rows.map((d: any) => {
              const badge = STATUS_BADGE[d.status] ?? { label: d.status, variant: "outline" as const };
              return (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.display_name}</TableCell>
                  <TableCell className="font-mono text-xs text-primary">{d.deposit_code}</TableCell>
                  <TableCell className="text-right font-bold text-chart-2">
                    {(d.amount ?? 0).toLocaleString("vi-VN")}đ
                  </TableCell>
                  <TableCell>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {d.sepay_tx_id ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(d.created_at).toLocaleString("vi-VN")}
                  </TableCell>
                  <TableCell>
                    <WebhookLogButton depositCode={d.deposit_code} onView={setViewPayload} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Tổng {total} giao dịch — Trang {page + 1}/{totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Webhook payload dialog */}
      <Dialog open={!!viewPayload} onOpenChange={() => setViewPayload(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Webhook Payload</DialogTitle>
          </DialogHeader>
          <pre className="bg-secondary/50 rounded-lg p-4 text-xs overflow-auto max-h-96 text-foreground">
            {JSON.stringify(viewPayload, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Sub-component to load webhook event for a deposit
function WebhookLogButton({ depositCode, onView }: { depositCode: string; onView: (p: any) => void }) {
  const fetchPayload = async () => {
    const { data } = await (supabase as any)
      .from("webhook_events")
      .select("payload")
      .ilike("payload->>content", `%${depositCode}%`)
      .limit(1)
      .single();
    onView(data?.payload ?? { message: "Không tìm thấy webhook log" });
  };

  return (
    <button onClick={fetchPayload} className="text-muted-foreground hover:text-primary" title="Xem webhook log">
      <Eye className="h-4 w-4" />
    </button>
  );
}
