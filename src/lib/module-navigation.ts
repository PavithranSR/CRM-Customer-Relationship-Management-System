export type ReportingModule = "CRM" | "SALES" | "PROJECT";

export function getModuleReportingHref(module: ReportingModule) {
  if (module === "SALES") {
    return "/crm/quotations/reporting";
  }

  if (module === "PROJECT") {
    return "/reports";
  }

  return "/crm/reporting";
}
