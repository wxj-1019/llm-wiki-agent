/**
 * Persistent alert banner displayed at the top of the layout.
 *
 * Merges system status (offline, backend-offline, PWA-update, PWA-install)
 * with notificationStore critical/warning alerts into a unified compact bar.
 *
 * Alerts are dismissible and auto-reappear if the condition persists.
 */
import { AlertTriangle, WifiOff, ServerOff, RefreshCw, Download, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNotificationStore } from "../../stores/notificationStore";
import { useWikiStore } from "../../stores/wikiStore";
import type { Severity } from "../../stores/notificationStore";

export interface AlertBannerProps {
  /** System-level status flags */
  isOffline?: boolean;
  isBackendOffline?: boolean;
  hasPwaUpdate?: boolean;
  showPwaInstall?: boolean;
  onPwaUpdate?: () => void;
  onPwaInstall?: () => void;
}

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  warning: 1,
  success: 2,
  info: 3,
};

const severityStyles: Record<Severity, string> = {
  critical: "bg-red-600 dark:bg-red-700 text-white",
  warning: "bg-amber-500 dark:bg-amber-600 text-white",
  success: "bg-emerald-600 dark:bg-emerald-700 text-white",
  info: "bg-blue-600 dark:bg-blue-700 text-white",
};

export function AlertBanner({
  isOffline = false,
  isBackendOffline = false,
  hasPwaUpdate = false,
  showPwaInstall = false,
  onPwaUpdate,
  onPwaInstall,
}: AlertBannerProps) {
  // B1 fix: use zustand selector to react to alert state changes
  const notifications = useNotificationStore((s) => s.notifications);
  const activeAlerts = notifications.filter((n) => n.isAlert);
  const dismissAlert = useNotificationStore((s) => s.dismissAlert);
  const checkApiHealth = useWikiStore((s) => s.checkApiHealth);

  interface UnifiedAlert {
    id: string;
    message: string;
    severity: Severity;
    timestamp: number;
    actionLabel?: string;
    onAction?: () => void;
    isSystem: boolean;
  }

  const allAlerts: UnifiedAlert[] = [];

  if (isOffline) {
    allAlerts.push({
      id: "system-offline",
      message: "网络连接已断开 — 部分功能不可用",
      severity: "warning",
      timestamp: 0,
      isSystem: true,
    });
  }

  if (isBackendOffline) {
    allAlerts.push({
      id: "system-backend-offline",
      message: "后端服务未响应 — 数据可能不是最新的",
      severity: "critical",
      timestamp: 0,
      // P4: add manual retry button
      actionLabel: "重试",
      onAction: () => checkApiHealth(),
      isSystem: true,
    });
  }

  if (hasPwaUpdate) {
    allAlerts.push({
      id: "system-pwa-update",
      message: "新版本可用",
      severity: "info",
      timestamp: 0,
      actionLabel: "更新",
      onAction: onPwaUpdate,
      isSystem: true,
    });
  }

  if (showPwaInstall) {
    allAlerts.push({
      id: "system-pwa-install",
      message: "安装为本地应用以获得更好体验",
      severity: "info",
      timestamp: 0,
      actionLabel: "安装",
      onAction: onPwaInstall,
      isSystem: true,
    });
  }

  for (const alert of activeAlerts) {
    allAlerts.push({
      id: alert.id,
      message: alert.message,
      severity: alert.severity || "info",
      timestamp: alert.timestamp,
      actionLabel: alert.action?.label,
      onAction: alert.action?.handler,
      isSystem: false,
    });
  }

  if (allAlerts.length === 0) return null;

  // P2: sort by severity priority then time descending
  allAlerts.sort((a, b) => {
    const s = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (s !== 0) return s;
    return b.timestamp - a.timestamp;
  });

  return (
    <div className="w-full z-[70]" role="alert" aria-live="assertive">
      <AnimatePresence>
        {allAlerts.map((alert) => {
          const styles = severityStyles[alert.severity] || severityStyles.info;

          const iconMap: Record<string, React.ReactNode> = {
            "system-offline": <WifiOff size={16} aria-hidden="true" />,
            "system-backend-offline": <ServerOff size={16} aria-hidden="true" />,
            "system-pwa-update": <RefreshCw size={16} aria-hidden="true" />,
            "system-pwa-install": <Download size={16} aria-hidden="true" />,
          };

          const icon = iconMap[alert.id] || (
            <AlertTriangle size={16} aria-hidden="true" />
          );

          return (
            <motion.div
              key={alert.id}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex items-center justify-between px-4 py-2 text-sm font-medium ${styles}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {icon}
                <span className="truncate">{alert.message}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                {alert.actionLabel && alert.onAction && (
                  <button
                    onClick={alert.onAction}
                    className="px-2 py-0.5 rounded text-xs font-semibold bg-white/20 hover:bg-white/30 transition-colors"
                  >
                    {alert.actionLabel}
                  </button>
                )}
                {!alert.isSystem && (
                  <button
                    onClick={() => dismissAlert(alert.id)}
                    className="p-0.5 rounded hover:bg-white/20 transition-colors"
                    aria-label="Dismiss alert"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
