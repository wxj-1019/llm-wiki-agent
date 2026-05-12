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

const severityStyles: Record<Severity, string> = {
  critical: "bg-red-600 text-white",
  warning: "bg-amber-500 text-white",
  success: "bg-green-600 text-white",
  info: "bg-blue-600 text-white",
};

export function AlertBanner({
  isOffline = false,
  isBackendOffline = false,
  hasPwaUpdate = false,
  showPwaInstall = false,
  onPwaUpdate,
  onPwaInstall,
}: AlertBannerProps) {
  const activeAlerts = useNotificationStore((s) => s.getActiveAlerts());
  const dismissAlert = useNotificationStore((s) => s.dismissAlert);

  // Build unified alert list: system banners first, then notificationStore alerts
  const allAlerts: {
    id: string;
    message: string;
    severity: Severity;
    actionLabel?: string;
    onAction?: () => void;
  }[] = [];

  if (isOffline) {
    allAlerts.push({
      id: "system-offline",
      message: "网络连接已断开 — 部分功能不可用",
      severity: "warning",
    });
  }

  if (isBackendOffline) {
    allAlerts.push({
      id: "system-backend-offline",
      message: "后端服务未响应 — 数据可能不是最新的",
      severity: "critical",
    });
  }

  if (hasPwaUpdate) {
    allAlerts.push({
      id: "system-pwa-update",
      message: "新版本可用",
      severity: "info",
      actionLabel: "更新",
      onAction: onPwaUpdate,
    });
  }

  if (showPwaInstall) {
    allAlerts.push({
      id: "system-pwa-install",
      message: "安装为本地应用以获得更好体验",
      severity: "info",
      actionLabel: "安装",
      onAction: onPwaInstall,
    });
  }

  // Append notificationStore alerts
  for (const alert of activeAlerts) {
    allAlerts.push({
      id: alert.id,
      message: alert.message,
      severity: alert.severity || "info",
      actionLabel: alert.action?.label,
      onAction: alert.action?.handler,
    });
  }

  if (allAlerts.length === 0) return null;

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
                {!alert.id.startsWith("system-") && (
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
