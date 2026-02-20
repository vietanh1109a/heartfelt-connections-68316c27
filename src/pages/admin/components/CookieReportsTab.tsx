import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Wifi, Loader2, Trash2, Clock, User, ChevronLeft, ChevronRight, RotateCcw, Shield } from "lucide-react";
import { parseCookieString } from "@/lib/parseCookies";

const PAGE_SIZE = 20;

function parseReportDetails(details: string | null): { text: string | null; reported_cookie_ids: string[] } {
  if (!details) return { text: null, reported_cookie_ids: [] };
  try {
    const parsed = JSON.parse(details);
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.reported_cookie_ids)) {
      return { text: parsed.text || null, reported_cookie_ids: parsed.reported_cookie_ids };
    }
  } catch {
    // Legacy plain text format
  }
  return { text: details, reported_cookie_ids: [] };
}

export function CookieReportsTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [actionTarget, setActionTarget] = useState<any>(null);
  const [actionType, setActionType] = useState<"check" | "reactivate" | "delete" | null>(null);
  const [processing, setProcessing] = useState(false);
  const [checkingLive, setCheckingLive] = useState(false);
  const [liveResults, setLiveResults] = useState<Record<string, boolean>>({});

  const { data: reportsData, isLoading, error: queryError } = useQuery({
    queryKey: ["cookie-reports", page],
    queryFn: async () => {
      console.log("[CookieReportsTab] Fetching reports, page:", page);
      // Fetch reports (no join — cookie_reports has no FK to profiles)
      const { data: rawReports, error, count } = await supabase
        .from("cookie_reports")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      
      console.log("[CookieReportsTab] Reports result:", { rawReports, error, count });
      if (error) {
        console.error("[CookieReportsTab] Query error:", error);
        throw error;
      }

      const reports = rawReports ?? [];

      // Fetch profiles for the user_ids in these reports
      const userIds = [...new Set(reports.map((r: any) => r.user_id))];
      let profilesMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("user_id, display_name, vip_expires_at")
          .in("user_id", userIds);
        console.log("[CookieReportsTab] Profiles result:", { profiles, profilesError });
        (profiles ?? []).forEach((p: any) => { profilesMap[p.user_id] = p; });
      }

      // Attach profiles to reports
      const enrichedReports = reports.map((r: any) => ({
        ...r,
        profiles: profilesMap[r.user_id] || null,
      }));

      return { reports: enrichedReports, total: count ?? 0 };
    },
    retry: 1,
  });

  const reports = reportsData?.reports ?? [];
  const totalPages = Math.ceil((reportsData?.total ?? 0) / PAGE_SIZE);
  const pendingCount = reports.filter((r: any) => r.status === "pending").length;

  // Log query error if any
  if (queryError) {
    console.error("[CookieReportsTab] Query failed:", queryError);
  }

  // Check if a reported cookie is live via extension
  const handleCheckLive = async (cookieId: string) => {
    setCheckingLive(true);
    try {
      // Fetch cookie data from stock (even if inactive)
      const { data: cookie } = await supabase
        .from("cookie_stock")
        .select("id, cookie_data")
        .eq("id", cookieId)
        .maybeSingle();

      if (!cookie?.cookie_data) {
        toast.error("Cookie không tồn tại hoặc đã bị xóa.");
        setCheckingLive(false);
        return;
      }

      const result = await new Promise<boolean>((resolve) => {
        const t = setTimeout(() => {
          window.removeEventListener("message", h);
          resolve(false);
        }, 15000);

        const h = (event: MessageEvent) => {
          if (event.data?.type === "CHECK_LIVE_RESULT" && event.data.id === cookieId) {
            clearTimeout(t);
            window.removeEventListener("message", h);
            resolve(event.data.alive === true);
          }
        };
        window.addEventListener("message", h);
        window.postMessage({
          type: "CHECK_LIVE_BATCH",
          cookieSets: [{ id: cookieId, cookies: parseCookieString(cookie.cookie_data) }],
        }, "*");
      });

      setLiveResults(prev => ({ ...prev, [cookieId]: result }));
      toast[result ? "success" : "warning"](result ? "✅ Cookie còn sống!" : "⚠️ Cookie đã chết!");
    } catch (e: any) {
      toast.error("Lỗi kiểm tra: " + e.message);
    } finally {
      setCheckingLive(false);
    }
  };

  // Reactivate cookie (mark live → return to stock)
  const handleReactivateCookie = async (cookieId: string, reportId: string) => {
    setProcessing(true);
    try {
      await supabase.from("cookie_stock").update({ is_active: true }).eq("id", cookieId);
      await supabase.from("cookie_reports").update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
      }).eq("id", reportId);
      toast.success("✅ Cookie đã được thả lại vào kho (LIVE)");
      queryClient.invalidateQueries({ queryKey: ["cookie-reports"] });
      queryClient.invalidateQueries({ queryKey: ["admin-cookies"] });
      queryClient.invalidateQueries({ queryKey: ["pending-reports-count"] });
    } catch (e: any) {
      toast.error("Lỗi: " + e.message);
    } finally {
      setProcessing(false);
      setActionTarget(null);
      setActionType(null);
    }
  };

  // Delete cookie (mark die → remove from stock permanently)
  const handleDeleteCookie = async (cookieId: string, reportId: string) => {
    setProcessing(true);
    try {
      // First remove any assignments referencing this cookie
      await supabase.from("user_cookie_assignment").delete().eq("cookie_id", cookieId);
      // Then delete from stock
      await supabase.from("cookie_stock").delete().eq("id", cookieId);
      await supabase.from("cookie_reports").update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
      }).eq("id", reportId);
      toast.success("🗑️ Cookie đã bị xóa khỏi kho (DIE)");
      queryClient.invalidateQueries({ queryKey: ["cookie-reports"] });
      queryClient.invalidateQueries({ queryKey: ["admin-cookies"] });
      queryClient.invalidateQueries({ queryKey: ["pending-reports-count"] });
    } catch (e: any) {
      toast.error("Lỗi: " + e.message);
    } finally {
      setProcessing(false);
      setActionTarget(null);
      setActionType(null);
    }
  };

  const handleMarkResolved = async (reportId: string) => {
    await supabase.from("cookie_reports").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", reportId);
    queryClient.invalidateQueries({ queryKey: ["cookie-reports"] });
    queryClient.invalidateQueries({ queryKey: ["pending-reports-count"] });
    toast.success("Đã đánh dấu đã xử lý");
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Vừa xong";
    if (mins < 60) return `${mins} phút trước`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    return `${days} ngày trước`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-foreground">Báo cáo lỗi cookie</h2>
          {pendingCount > 0 && (
            <span className="inline-flex items-center gap-1.5 bg-destructive/20 text-destructive border border-destructive/30 text-xs font-bold px-2.5 py-1 rounded-full">
              <AlertTriangle className="h-3 w-3" />
              {pendingCount} chờ xử lý
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["cookie-reports"] })}
        >
          Làm mới
        </Button>
      </div>

      {/* Info banner */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground">📋 Quy trình xử lý:</p>
        <p>1. Cookie bị báo lỗi sẽ <span className="text-yellow-400 font-medium">tạm rút khỏi kho</span> (is_active = false)</p>
        <p>2. Admin kiểm tra cookie: <span className="text-green-400 font-medium">LIVE → thả lại vào kho</span> | <span className="text-destructive font-medium">DIE → xóa vĩnh viễn</span></p>
        <p>3. Hệ thống tự phát hiện spam: Free 2 lần/3 phút, VIP 4 lần/5 phút → <span className="text-destructive font-medium">Ban 1 ngày + thu hồi quyền lợi</span></p>
      </div>

      <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Người dùng</TableHead>
              <TableHead>Lý do</TableHead>
              <TableHead>Cookie ID</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Thời gian</TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : reports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Chưa có báo cáo nào
                </TableCell>
              </TableRow>
            ) : reports.map((report: any) => {
              const parsed = parseReportDetails(report.details);
              const reportedCookieIds = parsed.reported_cookie_ids;
              const userText = parsed.text;

              return (
                <TableRow
                  key={report.id}
                  className={report.status === "pending" ? "bg-destructive/5" : ""}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <div>
                        <span className="text-sm font-medium text-foreground block">
                          {report.profiles?.display_name || "—"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {report.user_id?.slice(0, 8)}...
                        </span>
                      </div>
                      {report.profiles?.vip_expires_at && new Date(report.profiles.vip_expires_at) > new Date() && (
                        <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full font-bold">VIP</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[180px]">
                      <span className="text-sm text-foreground font-medium block truncate">{report.reason || "—"}</span>
                      {userText && (
                        <span className="text-xs text-muted-foreground block truncate" title={userText}>{userText}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {reportedCookieIds.length > 0 ? (
                      <div className="space-y-1">
                        {reportedCookieIds.map((cid: string) => (
                          <div key={cid} className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] text-muted-foreground">{cid.slice(0, 8)}...</span>
                            {liveResults[cid] !== undefined && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${liveResults[cid] ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                                {liveResults[cid] ? "LIVE" : "DIE"}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {report.status === "pending" ? (
                      <Badge variant="destructive" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        Chờ xử lý
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-green-400 border-green-500/30 bg-green-500/10">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Đã xử lý
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs">
                      <span className="text-foreground block">{formatTimeAgo(report.created_at)}</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(report.created_at).toLocaleString("vi-VN")}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {report.status === "pending" && (
                      <div className="flex gap-1 justify-end flex-wrap">
                        {/* Check live for each reported cookie */}
                        {reportedCookieIds.map((cid: string) => (
                          <Button
                            key={`check-${cid}`}
                            size="sm"
                            variant="outline"
                            title={`Check live cookie ${cid.slice(0, 8)}`}
                            onClick={() => handleCheckLive(cid)}
                            disabled={checkingLive}
                            className="text-xs gap-1"
                          >
                            {checkingLive ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wifi className="h-3 w-3" />}
                            Check
                          </Button>
                        ))}
                        {/* Reactivate (LIVE) */}
                        {reportedCookieIds.length > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            title="Cookie còn sống → thả lại vào kho"
                            onClick={() => { setActionTarget(report); setActionType("reactivate"); }}
                            className="text-xs gap-1 text-green-400 border-green-500/30 hover:bg-green-500/10"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Live
                          </Button>
                        )}
                        {/* Delete (DIE) */}
                        {reportedCookieIds.length > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            title="Cookie đã chết → xóa khỏi kho"
                            onClick={() => { setActionTarget(report); setActionType("delete"); }}
                            className="text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3 w-3" />
                            Die
                          </Button>
                        )}
                        {/* Fallback: just mark resolved */}
                        {reportedCookieIds.length === 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            title="Đánh dấu đã xử lý"
                            onClick={() => handleMarkResolved(report.id)}
                            className="text-green-400 hover:text-green-300 text-xs"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    )}
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
          <span>Trang {page + 1}/{totalPages}</span>
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

      {/* Confirm Dialog for Live/Die actions */}
      <Dialog open={!!actionTarget && !!actionType} onOpenChange={() => { setActionTarget(null); setActionType(null); }}>
        <DialogContent className="bg-card max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionType === "reactivate" ? (
                <><RotateCcw className="h-5 w-5 text-green-400" /> Thả cookie lại vào kho (LIVE)</>
              ) : (
                <><Trash2 className="h-5 w-5 text-destructive" /> Xóa cookie khỏi kho (DIE)</>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-secondary/50 border border-border/40 rounded-lg p-4 space-y-2 text-sm">
              <p><span className="text-muted-foreground">Người báo:</span> <span className="text-foreground font-medium">{actionTarget?.profiles?.display_name || "—"}</span></p>
              <p><span className="text-muted-foreground">Lý do:</span> <span className="text-foreground">{actionTarget?.reason}</span></p>
              {(() => {
                const parsed = actionTarget ? parseReportDetails(actionTarget.details) : { reported_cookie_ids: [] };
                return parsed.reported_cookie_ids.map((cid: string) => (
                  <p key={cid}><span className="text-muted-foreground">Cookie:</span> <span className="font-mono text-xs text-foreground">{cid}</span></p>
                ));
              })()}
            </div>
            {actionType === "reactivate" ? (
              <p className="text-sm text-muted-foreground">
                Cookie sẽ được <span className="text-green-400 font-medium">kích hoạt lại</span> và đưa trở lại kho để cấp cho người dùng khác.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Cookie sẽ bị <span className="text-destructive font-medium">xóa vĩnh viễn</span> khỏi hệ thống. Hành động không thể hoàn tác.
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setActionTarget(null); setActionType(null); }}>Hủy</Button>
            <Button
              variant={actionType === "delete" ? "destructive" : "default"}
              disabled={processing}
              onClick={() => {
                if (!actionTarget) return;
                const parsed = parseReportDetails(actionTarget.details);
                const cookieIds = parsed.reported_cookie_ids;
                if (cookieIds.length === 0) {
                  handleMarkResolved(actionTarget.id);
                  setActionTarget(null);
                  setActionType(null);
                  return;
                }
                // Process all reported cookies
                if (actionType === "reactivate") {
                  // Reactivate all cookies then mark resolved
                  Promise.all(cookieIds.map((cid: string) =>
                    supabase.from("cookie_stock").update({ is_active: true }).eq("id", cid)
                  )).then(() => {
                    supabase.from("cookie_reports").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", actionTarget.id).then(() => {
                      toast.success("✅ Cookie đã được thả lại vào kho");
                      queryClient.invalidateQueries({ queryKey: ["cookie-reports"] });
                      queryClient.invalidateQueries({ queryKey: ["admin-cookies"] });
                      queryClient.invalidateQueries({ queryKey: ["pending-reports-count"] });
                      setActionTarget(null);
                      setActionType(null);
                    });
                  });
                } else {
                  // Delete all reported cookies
                  Promise.all(cookieIds.map((cid: string) =>
                    supabase.from("user_cookie_assignment").delete().eq("cookie_id", cid).then(() =>
                      supabase.from("cookie_stock").delete().eq("id", cid)
                    )
                  )).then(() => {
                    supabase.from("cookie_reports").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", actionTarget.id).then(() => {
                      toast.success("🗑️ Cookie đã bị xóa khỏi kho");
                      queryClient.invalidateQueries({ queryKey: ["cookie-reports"] });
                      queryClient.invalidateQueries({ queryKey: ["admin-cookies"] });
                      queryClient.invalidateQueries({ queryKey: ["pending-reports-count"] });
                      setActionTarget(null);
                      setActionType(null);
                    });
                  });
                }
              }}
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {actionType === "reactivate" ? "Xác nhận thả vào kho" : "Xác nhận xóa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
