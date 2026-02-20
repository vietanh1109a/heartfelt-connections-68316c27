/* eslint-disable @typescript-eslint/no-explicit-any */
declare const chrome: any;
import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Wifi, Loader2, AlertTriangle, CheckCircle2, Settings2, Upload, PlayCircle, Download, XCircle, ChevronLeft, ChevronRight, CheckCheck } from "lucide-react";
import JSZip from "jszip";
import { Progress } from "@/components/ui/progress";

const EXTENSION_ID_KEY = "netflix_extension_id";
const DEFAULT_EXTENSION_ID = "mbfelihlmccinflppkedegkojemplfml";

// Parse Netscape cookie string to cookie objects
function parseCookieString(cookieString: string) {
  const cookies: any[] = [];
  const lines = cookieString.split("\n").map(s => s.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.startsWith("#") || line.startsWith("//")) continue;
    const tabs = line.split("\t");
    if (tabs.length >= 7) {
      cookies.push({
        domain: tabs[0].trim(),
        path: tabs[2].trim(),
        secure: tabs[3].trim().toUpperCase() === "TRUE",
        expirationDate: parseInt(tabs[4].trim(), 10) || undefined,
        name: tabs[5].trim(),
        value: tabs[6].trim(),
        httpOnly: false,
      });
    }
  }
  return cookies;
}

// Helper to send message directly to extension
function sendToExtension(extensionId: string, message: any, timeoutMs = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      console.log("[CookieStock] sendToExtension TIMEOUT after", timeoutMs, "ms");
      reject(new Error("Timeout — extension không phản hồi"));
    }, timeoutMs);
    try {
      if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        console.log("[CookieStock] Calling chrome.runtime.sendMessage to", extensionId);
        chrome.runtime.sendMessage(extensionId, message, (response: any) => {
          clearTimeout(timer);
          if (chrome.runtime.lastError) {
            console.log("[CookieStock] chrome.runtime.lastError:", chrome.runtime.lastError.message);
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            console.log("[CookieStock] Got response from extension:", response);
            resolve(response);
          }
        });
      } else {
        clearTimeout(timer);
        console.log("[CookieStock] chrome.runtime.sendMessage not available");
        reject(new Error("chrome.runtime not available"));
      }
    } catch (e: any) {
      clearTimeout(timer);
      console.log("[CookieStock] sendToExtension exception:", e.message);
      reject(e);
    }
  });
}

const COOKIE_PAGE_SIZE = 30;

export function CookieStockTab() {
  const [cookiePage, setCookiePage] = useState(0);
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editCookie, setEditCookie] = useState<any>(null);
  const [cookieData, setCookieData] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [checkResults, setCheckResults] = useState<Record<string, { alive: boolean; detail: string }>>({});
  const [extensionReady, setExtensionReady] = useState(false);
  const [extensionVersion, setExtensionVersion] = useState<string | null>(null);
  const [extensionId, setExtensionId] = useState(() => localStorage.getItem(EXTENSION_ID_KEY) || DEFAULT_EXTENSION_ID);
  const [showSettings, setShowSettings] = useState(false);
  const [tempExtId, setTempExtId] = useState(extensionId);
  const [checkAllRunning, setCheckAllRunning] = useState(false);
  const [checkAllProgress, setCheckAllProgress] = useState({ current: 0, total: 0 });
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const checkingIdRef = useRef<string | null>(null);

  // Save extension ID to localStorage
  const saveExtensionId = (id: string) => {
    setExtensionId(id);
    localStorage.setItem(EXTENSION_ID_KEY, id);
    setShowSettings(false);
    // Re-check connection
    checkExtensionConnection(id);
  };

  // Check extension connection via postMessage (primary) + direct (fallback)
  const checkExtensionConnection = async (id?: string) => {
    console.log("[CookieStock] Checking extension via postMessage PING...");
    // Primary: use postMessage — content script will respond
    window.postMessage({ type: "PING_EXTENSION" }, "*");
    window.postMessage({ type: "GET_EXTENSION_VERSION" }, "*");
  };

  // Listen for extension messages (fallback via content script)
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const t = event.data?.type;
      if (!t || typeof t !== "string") return;

      if (t === "EXTENSION_READY" || t === "EXTENSION_VERSION_RESPONSE" || t === "PONG_EXTENSION") {
        console.log("[CookieStock] ✅ Extension detected!", t, event.data.version);
        setExtensionReady(true);
        setExtensionVersion(event.data.version || "unknown");
      }
      if (t === "CHECK_LIVE_RESULT") {
        console.log("[CookieStock] CHECK_LIVE_RESULT:", event.data);
        handleCheckResult(event.data);
        // Update batch progress
        if (event.data.total > 1) {
          setCheckAllProgress({ current: (event.data.index || 0) + 1, total: event.data.total });
        }
      }
      if (t === "CHECK_LIVE_COMPLETE") {
        console.log("[CookieStock] CHECK_LIVE_COMPLETE");
        setCheckingId(null);
        setCheckAllRunning(false);
        setCheckAllProgress({ current: 0, total: 0 });
        checkingIdRef.current = null;
      }
    };
    window.addEventListener("message", handler);

    // Ping extension via postMessage
    checkExtensionConnection();

    return () => window.removeEventListener("message", handler);
  }, [extensionId]);

  const handleCheckResult = (data: any) => {
    const { id, alive, detail } = data;
    setCheckResults(prev => ({ ...prev, [id]: { alive, detail } }));
    setCheckingId(null);
    checkingIdRef.current = null;

    if (alive) {
      toast.success(`✅ Cookie LIVE — ${detail}`);
    } else {
      toast.error(`❌ Cookie DIE — ${detail}`);
      supabase.from("cookie_stock").update({ is_active: false }).eq("id", id).then(() => {
        queryClient.invalidateQueries({ queryKey: ["admin-cookies"] });
      });
    }
  };

  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Cookie reports query
  const { data: cookieReports } = useQuery({
    queryKey: ["admin-cookie-reports"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cookie_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const handleResolveReport = async (reportId: string) => {
    setResolvingId(reportId);
    const { error } = await supabase
      .from("cookie_reports")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", reportId);
    if (error) { toast.error("Lỗi cập nhật: " + error.message); }
    else { toast.success("Đã đánh dấu đã xử lý"); queryClient.invalidateQueries({ queryKey: ["admin-cookie-reports"] }); }
    setResolvingId(null);
  };

  const { data: cookieData2, isLoading } = useQuery({
    queryKey: ["admin-cookies", cookiePage],
    queryFn: async () => {
      const from = cookiePage * COOKIE_PAGE_SIZE;
      const to = from + COOKIE_PAGE_SIZE - 1;
      const { data, error, count } = await supabase
        .from("cookie_stock")
        .select("*", { count: "exact" })
        .order("updated_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return { cookies: data ?? [], total: count ?? 0 };
    },
  });
  const cookies = cookieData2?.cookies ?? [];
  const totalCookies = cookieData2?.total ?? 0;
  const totalCookiePages = Math.ceil(totalCookies / COOKIE_PAGE_SIZE);

  const handleSave = async () => {
    if (!cookieData.trim()) { toast.error("Cookie data không được trống"); return; }
    if (editCookie) {
      const { error } = await supabase.from("cookie_stock").update({ cookie_data: cookieData }).eq("id", editCookie.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Đã cập nhật cookie");
    } else {
      const { error } = await supabase.from("cookie_stock").insert({ cookie_data: cookieData, is_active: true });
      if (error) { toast.error(error.message); return; }
      toast.success("Đã thêm cookie mới");
    }
    queryClient.invalidateQueries({ queryKey: ["admin-cookies"] });
    setShowAdd(false);
    setEditCookie(null);
    setCookieData("");
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    const { error } = await supabase.from("cookie_stock").update({ is_active: !currentActive }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(currentActive ? "Đã tắt cookie" : "Đã kích hoạt cookie");
    queryClient.invalidateQueries({ queryKey: ["admin-cookies"] });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("cookie_stock").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Đã xoá cookie");
    setDeleteTarget(null);
    queryClient.invalidateQueries({ queryKey: ["admin-cookies"] });
  };

  const handleCheckLive = async (id: string, cookie_data: string) => {
    setCheckingId(id);
    checkingIdRef.current = id;
    const parsedCookies = parseCookieString(cookie_data);
    console.log("[CookieStock] handleCheckLive via postMessage", { id, cookieCount: parsedCookies.length });

    // Use postMessage via content script (works reliably on all Chromium browsers)
    window.postMessage({
      type: "CHECK_LIVE_BATCH",
      cookieSets: [{ id, cookies: parsedCookies }]
    }, "*");

    // Timeout
    setTimeout(() => {
      if (checkingIdRef.current === id) {
        setCheckingId(null);
        checkingIdRef.current = null;
        toast.error("⚠️ Extension không phản hồi sau 60s. Reload extension và thử lại.");
      }
    }, 60000);
  };

  // === Check All ===
  const handleCheckAll = () => {
    if (!cookies || cookies.length === 0) return;
    const activeCookies = cookies.filter(c => c.is_active);
    if (activeCookies.length === 0) { toast.error("Không có cookie active"); return; }

    setCheckAllRunning(true);
    setCheckAllProgress({ current: 0, total: activeCookies.length });
    const cookieSets = activeCookies.map(c => ({
      id: c.id,
      cookies: parseCookieString(c.cookie_data),
    }));

    window.postMessage({ type: "CHECK_LIVE_BATCH", cookieSets }, "*");

    // Timeout for entire batch
    setTimeout(() => {
      setCheckAllRunning(prev => {
        if (prev) toast.error("⚠️ Batch check timeout");
        return false;
      });
    }, activeCookies.length * 25000 + 10000);
  };

  // === File Upload (multiple files) ===
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setImporting(true);
    let totalImported = 0;
    let totalFiles = files.length;
    try {
      for (const file of Array.from(files)) {
        const text = await file.text();
        // Each file = 1 cookie entry
        const trimmed = text.trim();
        if (!trimmed) continue;
        const { error } = await supabase.from("cookie_stock").insert({ cookie_data: trimmed, is_active: true });
        if (!error) totalImported++;
      }
      toast.success(`Đã import ${totalImported}/${totalFiles} file cookie`);
      queryClient.invalidateQueries({ queryKey: ["admin-cookies"] });
    } catch (err: any) {
      toast.error("Lỗi: " + err.message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // === Export Live cookies as ZIP ===
  const handleExportLive = async () => {
    const liveCookies = cookies?.filter(c => c.is_active) || [];
    if (liveCookies.length === 0) { toast.error("Không có cookie active để xuất"); return; }
    const zip = new JSZip();
    const folder = zip.folder("live")!;
    liveCookies.forEach((c, i) => {
      folder.file(`cookie_${i + 1}.txt`, c.cookie_data);
    });
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `live_cookies_${new Date().toISOString().slice(0, 10)}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Đã xuất ${liveCookies.length} cookie live`);
  };

  // === Clear Die cookies ===
  const handleClearDie = async () => {
    const dieCookies = cookies?.filter(c => !c.is_active) || [];
    if (dieCookies.length === 0) { toast.error("Không có cookie die để xóa"); return; }
    const { error } = await supabase.from("cookie_stock").delete().eq("is_active", false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Đã xóa ${dieCookies.length} cookie die`);
    queryClient.invalidateQueries({ queryKey: ["admin-cookies"] });
  };

  return (
    <>
      {/* Cookie Reports Panel */}
      {(cookieReports?.length ?? 0) > 0 && (
        <div className="mb-4 border border-yellow-500/30 bg-yellow-500/5 rounded-xl p-4">
          <h3 className="font-bold text-foreground mb-3 flex items-center gap-2 text-sm">
            <span className="text-yellow-500">⚠️</span> Báo cáo cookie hỏng ({cookieReports?.filter(r => r.status !== "resolved").length ?? 0} chưa xử lý)
          </h3>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {cookieReports?.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between bg-card/60 rounded-lg px-3 py-2 border border-border/30">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-foreground font-medium truncate">{r.reason}{r.details ? ` — ${r.details}` : ""}</p>
                  <p className="text-[10px] text-muted-foreground">User: {r.user_id.slice(0, 8)}... • {new Date(r.created_at).toLocaleString("vi-VN")}</p>
                </div>
                <div className="flex items-center gap-2 ml-2 shrink-0">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${r.status === "resolved" ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                    {r.status === "resolved" ? "Đã xử lý" : "Chờ xử lý"}
                  </span>
                  {r.status !== "resolved" && (
                    <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] gap-1" onClick={() => handleResolveReport(r.id)} disabled={resolvingId === r.id}>
                      <CheckCheck className="h-3 w-3" />
                      Resolve
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Extension Status Bar */}
      <div className={`flex items-center justify-between gap-2 mb-4 p-3 rounded-lg text-sm ${
        extensionReady 
          ? "bg-green-500/10 border border-green-500/30 text-green-400" 
          : "bg-muted/50 border border-border text-muted-foreground"
      }`}>
        <div className="flex items-center gap-2">
          {extensionReady ? (
            <>
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Extension v{extensionVersion} — Đã kết nối</span>
            </>
          ) : (
            <>
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Extension chưa kết nối. Kiểm tra Extension ID và reload extension sau khi cập nhật.</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => checkExtensionConnection()} className="text-xs h-7">
            Thử lại
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setTempExtId(extensionId); setShowSettings(true); }} className="text-xs h-7">
            <Settings2 className="h-3 w-3 mr-1" />
            ID: {extensionId.slice(0, 8)}...
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
        <p className="text-sm text-muted-foreground">
          {cookies?.filter((c) => c.is_active).length || 0} active / {cookies?.length || 0} tổng
        </p>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.cookie,.cookies"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing}>
            {importing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
            Import TXT
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportLive} disabled={!cookies?.some(c => c.is_active)}>
            <Download className="h-4 w-4 mr-1" />
            Export Live
          </Button>
          <Button variant="outline" size="sm" onClick={handleClearDie} disabled={!cookies?.some(c => !c.is_active)} className="text-destructive border-destructive/30 hover:bg-destructive/10">
            <XCircle className="h-4 w-4 mr-1" />
            Clear Die
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCheckAll}
            disabled={checkAllRunning || !extensionReady}
          >
            {checkAllRunning ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <PlayCircle className="h-4 w-4 mr-1" />}
            Check All {checkAllRunning && checkAllProgress.total > 0 ? `(${checkAllProgress.current}/${checkAllProgress.total})` : ""}
          </Button>
          <Button onClick={() => { setShowAdd(true); setCookieData(""); setEditCookie(null); }}>
            <Plus className="h-4 w-4 mr-2" /> Thêm Cookie
          </Button>
        </div>
      </div>

      {/* Batch progress bar */}
      {checkAllRunning && checkAllProgress.total > 0 && (
        <div className="mb-4">
          <Progress value={(checkAllProgress.current / checkAllProgress.total) * 100} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1">
            Đang check {checkAllProgress.current}/{checkAllProgress.total}...
          </p>
        </div>
      )}

      <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Cookie Data</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Cập nhật</TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Đang tải...</TableCell>
              </TableRow>
            ) : cookies?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Chưa có cookie nào</TableCell>
              </TableRow>
            ) : cookies?.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs">{c.id.slice(0, 8)}...</TableCell>
                <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                  {c.cookie_data.slice(0, 80)}...
                </TableCell>
                <TableCell>
                  <button
                    onClick={() => handleToggleActive(c.id, c.is_active)}
                    className={`text-xs px-2 py-0.5 rounded-full cursor-pointer ${c.is_active ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}
                  >
                    {c.is_active ? "Active" : "Inactive"}
                  </button>
                  {checkResults[c.id] && (
                    <span className={`ml-2 text-xs ${checkResults[c.id].alive ? "text-green-400" : "text-red-400"}`}>
                      {checkResults[c.id].alive ? "LIVE ✓" : "DIE ✗"}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(c.updated_at).toLocaleString("vi-VN")}
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCheckLive(c.id, c.cookie_data)}
                    disabled={checkingId === c.id}
                    className="text-xs"
                  >
                    {checkingId === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wifi className="h-3 w-3" />}
                    <span className="ml-1">Check</span>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditCookie(c); setCookieData(c.cookie_data); setShowAdd(true); }}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteTarget(c.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Cookie Pagination */}
      {totalCookiePages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground mt-3">
          <span>Tổng {totalCookies} cookie — Trang {cookiePage + 1}/{totalCookiePages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setCookiePage(p => Math.max(0, p - 1))} disabled={cookiePage === 0}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCookiePage(p => Math.min(totalCookiePages - 1, p + 1))} disabled={cookiePage >= totalCookiePages - 1}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-card max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editCookie ? "Sửa Cookie" : "Thêm Cookie Mới"}</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Dán cookie data vào đây (Netscape format hoặc name=value)"
            value={cookieData}
            onChange={(e) => setCookieData(e.target.value)}
            rows={12}
            className="font-mono text-xs"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAdd(false); setEditCookie(null); }}>Huỷ</Button>
            <Button onClick={handleSave}>{editCookie ? "Cập nhật" : "Thêm"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="bg-card max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive">Xoá cookie</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Bạn có chắc muốn xoá cookie này? Hành động không thể hoàn tác.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Huỷ</Button>
            <Button variant="destructive" onClick={() => deleteTarget && handleDelete(deleteTarget)}>Xoá</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extension ID Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="bg-card max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Extension ID
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Mở <code className="bg-muted px-1 rounded">chrome://extensions</code> → tìm Netflix Cookie Manager → copy "Mã nhận dạng" và dán vào đây.
            </p>
            <Input
              value={tempExtId}
              onChange={(e) => setTempExtId(e.target.value)}
              placeholder="Extension ID"
              className="font-mono text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettings(false)}>Huỷ</Button>
            <Button onClick={() => saveExtensionId(tempExtId.trim())}>Lưu & Kết nối</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
