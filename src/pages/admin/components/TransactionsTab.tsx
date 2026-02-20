import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 20;

export function TransactionsTab() {
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-all-transactions", page],
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error, count } = await supabase
        .from("transactions")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;

      // Fetch profile names for display
      const userIds = [...new Set((data ?? []).map((t) => t.user_id))];
      if (userIds.length === 0) return { transactions: [], total: 0 };
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);

      const nameMap = new Map(profiles?.map((p) => [p.user_id, p.display_name]) || []);
      return {
        transactions: (data ?? []).map((t) => ({ ...t, display_name: nameMap.get(t.user_id) || "—" })),
        total: count ?? 0,
      };
    },
  });

  const transactions = data?.transactions ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-3">
      <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Người dùng</TableHead>
              <TableHead>Loại</TableHead>
              <TableHead className="text-right">Số tiền</TableHead>
              <TableHead>Ghi chú</TableHead>
              <TableHead>Thời gian</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Đang tải...</TableCell>
              </TableRow>
            ) : !transactions.length ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Chưa có giao dịch</TableCell>
              </TableRow>
            ) : transactions.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{(t as any).display_name}</TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${t.type === "deposit" ? "bg-green-500/20 text-green-400" : "bg-orange-500/20 text-orange-400"}`}>
                    {t.type === "deposit" ? "Nạp tiền" : "Sử dụng"}
                  </span>
                </TableCell>
                <TableCell className={`text-right font-bold ${t.type === "deposit" ? "text-green-400" : "text-orange-400"}`}>
                  {t.type === "deposit" ? "+" : "-"}{(t.amount ?? 0).toLocaleString("vi-VN")}đ
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{t.memo || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(t.created_at).toLocaleString("vi-VN")}
                </TableCell>
              </TableRow>
            ))}
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
    </div>
  );
}
