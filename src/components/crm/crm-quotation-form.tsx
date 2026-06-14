"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { confirmCrmQuotation, createCrmQuotation, generateQuotationNo } from "@/actions/quotation.actions";
import type { CrmLeadItem } from "@/actions/crm.actions";
import type { CrmProjectTypeItem } from "@/actions/crm-project-types.actions";
import { CrmProjectPickerDialog, type ProjectPickerProject } from "@/components/crm/crm-project-picker-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface CrmQuotationFormProps {
  lead: CrmLeadItem;
  salespersonName: string;
  projectTypes: Array<
    Pick<
      CrmProjectTypeItem,
      "id" | "name" | "budget" | "category" | "gstPercent" | "status" | "description" | "createdAt" | "updatedAt"
    >
  >;
}

function mergeCategoryTag(tags: string, category: string) {
  const categoryTag = `Category: ${category}`;
  const plainTags = tags
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && !/^category\s*:/i.test(entry));

  return [categoryTag, ...plainTags].join(", ");
}

export function CrmQuotationForm({ lead, salespersonName, projectTypes }: CrmQuotationFormProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const opportunityTitle = lead.title || lead.serviceName || lead.clientName || "Opportunity";
  const title = `${opportunityTitle} - Quotation`;
  const [availableProjectTypes, setAvailableProjectTypes] = useState(projectTypes);
  const clientName = lead.clientName || lead.title || "";
  const clientEmail = lead.email || "";
  const [quotationNo, setQuotationNo] = useState("");
  const initialValidUntil =
    lead.expectedClosingDate ? new Date(lead.expectedClosingDate).toISOString().split("T")[0] : "";
  const validUntil = initialValidUntil;
  const [status, setStatus] = useState<"DRAFT" | "SENT" | "APPROVED" | "REJECTED">("DRAFT");
  const [activeTab, setActiveTab] = useState<"order_lines" | "other_info">("order_lines");
  const [activeStage, setActiveStage] = useState<"quotation" | "sent" | "sales">("quotation");
  const [projectPickerLineId, setProjectPickerLineId] = useState<string | null>(null);
  const projectTitle = opportunityTitle;
  const [lineItems, setLineItems] = useState<
    Array<{
      id: string;
      name: string;
      unitCount: string;
      unitPrice: string;
      discount: string;
      amount: string;
      gst: string;
      tags: string;
    }>
  >([]);
  const serviceName = lead.serviceName || "";
  const unitName = lead.unitName || "";
  const unitCount = String(lead.unitCount ?? 1);
  const gstPercent = String(lead.gstPercent ?? 0);
  const totals = useMemo(() => {
    const subtotal = lineItems.reduce((sum, item) => {
      const amount = Number(item.amount || 0);
      return sum + amount;
    }, 0);
    const taxTotal = lineItems.reduce((sum, item) => {
      const amount = Number(item.amount || 0);
      const gst = Number(item.gst || 0);
      return sum + amount * (gst / 100);
    }, 0);
    return {
      subtotal,
      taxTotal,
      total: subtotal + taxTotal,
    };
  }, [lineItems]);
  const [terms, setTerms] = useState("50% advance before start. Balance due on delivery.");
  const [notes, setNotes] = useState(lead.notes || "");

  useEffect(() => {
    let isMounted = true;
    generateQuotationNo()
      .then((value) => {
        if (isMounted) setQuotationNo(value);
      })
      .catch(() => {
        if (isMounted) setQuotationNo("");
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const currentStage = activeStage === "sales" ? "sales" : status === "SENT" ? "sent" : "quotation";

  const handleLineChange = (id: string, field: keyof (typeof lineItems)[number], value: string) => {
    setLineItems((items) =>
      items.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, [field]: value };
        const qty = Number(next.unitCount || 0);
        const price = Number(next.unitPrice || 0);
        const discount = Number(next.discount || 0);
        const amount = Math.max(qty * price - discount, 0);
        return { ...next, amount: amount.toFixed(2) };
      }),
    );
  };

  const handleProjectNameChange = (id: string, value: string) => {
    if (value.trim().toLowerCase() === "see more") {
      setProjectPickerLineId(id);
      return;
    }
    const matched = availableProjectTypes.find((item) => item.name.toLowerCase() === value.trim().toLowerCase());
    setLineItems((items) =>
      items.map((item) => {
        if (item.id !== id) return item;
        const next = {
          ...item,
          name: value,
          unitPrice: matched ? String(matched.budget) : item.unitPrice,
          gst: matched ? String(matched.gstPercent) : item.gst,
          tags: matched ? mergeCategoryTag(item.tags, matched.category || "Other") : item.tags,
        };
        const qty = Number(next.unitCount || 0);
        const price = Number(next.unitPrice || 0);
        const discount = Number(next.discount || 0);
        const amount = Math.max(qty * price - discount, 0);
        return { ...next, amount: amount.toFixed(2) };
      }),
    );
  };

  const handleProjectDialogSelect = (projectType: ProjectPickerProject) => {
    if (!projectPickerLineId) return;

    setLineItems((items) =>
      items.map((item) => {
        if (item.id !== projectPickerLineId) return item;
        const next = {
          ...item,
          name: projectType.name,
          unitPrice: String(projectType.budget || 0),
          gst: String(projectType.gstPercent || 0),
          tags: mergeCategoryTag(item.tags, projectType.category || "Other"),
        };
        const qty = Number(next.unitCount || 0);
        const price = Number(next.unitPrice || 0);
        const discount = Number(next.discount || 0);
        const amount = Math.max(qty * price - discount, 0);
        return { ...next, amount: amount.toFixed(2) };
      }),
    );
  };

  const handleProjectCreated = (projectType: ProjectPickerProject) => {
    setAvailableProjectTypes((items) => {
      const nextItems = items.filter((item) => item.id !== projectType.id);
      return [projectType, ...nextItems];
    });
  };

  const selectedProjectName =
    projectPickerLineId === null ? "" : lineItems.find((item) => item.id === projectPickerLineId)?.name || "";

  const addLineItem = () => {
    setLineItems((items) => [
      ...items,
      { id: crypto.randomUUID(), name: "", unitCount: "1", unitPrice: "0", discount: "0", amount: "0", gst: "0", tags: "" },
    ]);
  };

  const removeLineItem = (id: string) => {
    setLineItems((items) => items.filter((item) => item.id !== id));
  };

  const handleSubmit = (mode: "send" | "confirm") => {
    const formData = new FormData();
    const isSendFlow = mode === "send";
    const isConfirmFlow = mode === "confirm";
    const nextStatus = isSendFlow ? "SENT" : "DRAFT";
    const effectiveSendNow = isSendFlow;
    formData.set("title", title);
    formData.set("clientName", clientName);
    formData.set("clientEmail", clientEmail);
    formData.set("projectTitle", projectTitle);
    formData.set("status", nextStatus);
    if (quotationNo) formData.set("quotationNo", quotationNo);
    formData.set(
      "items",
      JSON.stringify(
        lineItems.map((item) => ({
          id: item.id,
          name: item.name,
          unitCount: item.unitCount,
          amount: item.amount,
          gst: item.gst,
          tags: item.tags,
        })),
      ),
    );
    const primaryLine = lineItems.find((item) => item.name.trim());
    const derivedServiceName = primaryLine?.name || serviceName || projectTitle;
    formData.set("serviceName", derivedServiceName);
    formData.set("unitName", unitName || "Project");
    formData.set("unitCount", unitCount || "1");
    formData.set("unitPrice", totals.total.toFixed(2));
    formData.set("gstPercent", gstPercent || "0");
    if (validUntil) formData.set("validUntil", validUntil);
    if (terms) formData.set("terms", terms);
    if (notes) {
      const noteWithMeta = status === "APPROVED" || status === "REJECTED"
        ? `[Requested Status: ${status}] ${notes}`
        : notes;
      formData.set("notes", noteWithMeta);
    }
    formData.set("sendNow", String(effectiveSendNow));

    startTransition(async () => {
      const result = await createCrmQuotation(lead.id, formData);
      if (result.error) {
        const msg =
          typeof result.error === "string"
            ? result.error
            : Object.values(result.error).flat().filter(Boolean).join(", ");
        toast.error(msg || "Could not create quotation");
        return;
      }
      if (!result.data?.id) {
        toast.error("Quotation created but response was incomplete");
        return;
      }
      if (isConfirmFlow) {
        const confirmResult = await confirmCrmQuotation(result.data.id);
        if (confirmResult?.error) {
          toast.error(typeof confirmResult.error === "string" ? confirmResult.error : "Could not confirm quotation");
          return;
        }
        toast.success("Quotation confirmed");
      } else if (effectiveSendNow) {
        if (result.mailSent) {
          toast.success("Quotation created and sent");
        } else {
          toast.warning(result.mailMessage || "Quotation created but email was not sent");
        }
      } else {
        toast.success("Quotation created");
      }
      router.push(`/crm/${lead.id}/quotations/${result.data.id}`);
    });
  };

  return (
    <div className="space-y-6 rounded-md border bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            disabled={isPending}
            onClick={() => {
              setStatus("SENT");
              setActiveStage("sent");
              handleSubmit("send");
            }}
          >
            Send
          </Button>
          <Button type="button" variant="outline" disabled>
            Print
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={() => {
              setActiveStage("sales");
              handleSubmit("confirm");
            }}
          >
            Confirm
          </Button>
          <Button type="button" variant="outline" disabled>
            Preview
          </Button>
        </div>
        <div className="flex items-center overflow-hidden rounded-md border">
          <div
            className={`border-r px-4 py-1.5 text-sm ${
              currentStage === "quotation"
                ? "bg-cyan-50 font-semibold text-slate-900"
                : "text-slate-500"
            }`}
          >
            Quotation
          </div>
          <div
            className={`border-r px-4 py-1.5 text-sm ${
              currentStage === "sent"
                ? "bg-cyan-50 font-semibold text-slate-900"
                : "text-slate-500"
            }`}
          >
            Quotation Sent
          </div>
          <div
            className={`px-4 py-1.5 text-sm ${
              currentStage === "sales"
                ? "bg-cyan-50 font-semibold text-slate-900"
                : "text-slate-500"
            }`}
          >
            Sales Order
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quotation</p>
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">Prepared by: {salespersonName || "Sales"}</p>
        </div>
        <div className="min-w-[220px]">
          <Label>Quotation ID</Label>
          <Input value={quotationNo || "Generating..."} readOnly disabled />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 border-b">
            <button
              type="button"
              onClick={() => setActiveTab("order_lines")}
              className={`px-4 py-2 text-sm ${activeTab === "order_lines" ? "border-b-2 border-[#7c4a69] text-[#7c4a69]" : "text-slate-600"}`}
            >
              Order Lines
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("other_info")}
              className={`px-4 py-2 text-sm ${activeTab === "other_info" ? "border-b-2 border-[#7c4a69] text-[#7c4a69]" : "text-slate-600"}`}
            >
              Other Info
            </button>
          </div>
          {activeTab === "order_lines" ? (
            <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
              Add Product
            </Button>
          ) : null}
        </div>

        {activeTab === "order_lines" ? (
          <>
            <div className="overflow-x-auto rounded-md border">
              <datalist id="crm-project-type-options">
                {availableProjectTypes.map((projectType) => (
                  <option key={projectType.id} value={projectType.name} />
                ))}
                <option value="See more" />
              </datalist>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2 text-right">Quantity</th>
                    <th className="px-3 py-2 text-right">Unit Price</th>
                    <th className="px-3 py-2 text-right">Taxes</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500">
                        No product rows yet. Click Add Product.
                      </td>
                    </tr>
                  ) : (
                    lineItems.map((item) => {
                      return (
                        <tr key={item.id} className="border-t">
                          <td className="px-3 py-2">
                            <Input
                              value={item.name}
                              onChange={(event) => handleProjectNameChange(item.id, event.target.value)}
                              placeholder="Product name"
                              list="crm-project-type-options"
                              autoComplete="off"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Input
                              type="number"
                              min="0"
                              value={item.unitCount}
                              onChange={(event) => handleLineChange(item.id, "unitCount", event.target.value)}
                              className="text-right"
                              autoComplete="off"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(event) => handleLineChange(item.id, "unitPrice", event.target.value)}
                              className="text-right"
                              autoComplete="off"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.gst}
                              onChange={(event) => handleLineChange(item.id, "gst", event.target.value)}
                              className="text-right"
                              autoComplete="off"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.amount}
                              className="text-right"
                              autoComplete="off"
                              readOnly
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeLineItem(item.id)}>
                              Remove
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <div className="w-full max-w-xs space-y-2 rounded-md border bg-slate-50/60 p-3 text-sm">
                <div className="flex justify-between">
                  <span>Untaxed Amount</span>
                  <span className="font-semibold">{totals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Taxes</span>
                  <span className="font-semibold">{totals.taxTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 text-base font-semibold">
                  <span>Total</span>
                  <span>{totals.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Terms (manual)</Label>
              <Textarea rows={4} value={terms} onChange={(event) => setTerms(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Notes (manual)</Label>
              <Textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>
          </div>
        )}
      </div>

      <CrmProjectPickerDialog
        open={projectPickerLineId !== null}
        onOpenChange={(open) => {
          if (!open) setProjectPickerLineId(null);
        }}
        projectTypes={availableProjectTypes}
        onSelect={handleProjectDialogSelect}
        onProjectCreated={handleProjectCreated}
        selectedProjectName={selectedProjectName}
      />
    </div>
  );
}
