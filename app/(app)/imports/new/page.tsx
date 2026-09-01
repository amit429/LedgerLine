"use client";

import { CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Dropzone } from "@/components/imports/dropzone";
import type { Finding } from "@/lib/batches/findings";

const RECONCILE_STAGES = [
  "Normalising references and parsing dates",
  "Grouping charges and refunds by order",
  "Applying 12 rules",
  "Writing results",
];

const ORDERS_COLUMNS_HINT =
  "order_id · order_date · customer_email · currency · gross_amount · discount · net_amount · status";
const PAYMENTS_COLUMNS_HINT =
  "transaction_ref · processed_at · order_reference · currency · amount · fee · net_settled · type · status";

interface FileSummary {
  rowsRead: number;
  unique: number;
  columns: number;
  dateFormat: string;
}

interface UploadResponse {
  batchId: string;
  ordersSummary: FileSummary;
  paymentsSummary: FileSummary;
  findings: Finding[];
}

interface ValidationError {
  errors: string[];
  columnsFound: string[];
  columnsMissing: string[];
}

type WizardStep = "upload" | "check" | "rejected";

const FINDING_DOT: Record<Finding["tone"], string> = {
  reconciled: "bg-[var(--severity-reconciled)]",
  high: "bg-[var(--severity-high)]",
  medium: "bg-[var(--severity-medium)]",
};

export default function NewImportPage() {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>("upload");
  const [ordersFile, setOrdersFile] = useState<File | null>(null);
  const [paymentsFile, setPaymentsFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [genericError, setGenericError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [rejection, setRejection] = useState<{
    orders: ValidationError;
    payments: ValidationError;
  } | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconcileStage, setReconcileStage] = useState(0);
  const [reconcileError, setReconcileError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReconciling) return;
    const interval = setInterval(() => {
      setReconcileStage((stage) => Math.min(stage + 1, RECONCILE_STAGES.length - 1));
    }, 350);
    return () => clearInterval(interval);
  }, [isReconciling]);

  async function handleRunReconciliation() {
    if (!result) return;
    setReconcileError(null);
    setReconcileStage(0);
    setIsReconciling(true);

    const response = await fetch(`/api/batches/${result.batchId}/reconcile`, {
      method: "POST",
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setReconcileError(body.error ?? "Reconciliation failed. Please try again.");
      setIsReconciling(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function handleContinue() {
    if (!ordersFile || !paymentsFile) return;
    setIsSubmitting(true);
    setGenericError(null);

    const formData = new FormData();
    formData.append("orders", ordersFile);
    formData.append("payments", paymentsFile);

    const response = await fetch("/api/batches", {
      method: "POST",
      body: formData,
    });

    if (response.status === 400) {
      const body = await response.json();
      if (body.error === "validation_failed") {
        setRejection({ orders: body.orders, payments: body.payments });
        setStep("rejected");
        setIsSubmitting(false);
        return;
      }
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setGenericError(body.error ?? "Something went wrong. Please try again.");
      setIsSubmitting(false);
      return;
    }

    const body: UploadResponse = await response.json();
    setResult(body);
    setStep("check");
    setIsSubmitting(false);
  }

  function reset() {
    setOrdersFile(null);
    setPaymentsFile(null);
    setResult(null);
    setRejection(null);
    setGenericError(null);
    setStep("upload");
  }

  if (step === "rejected" && rejection) {
    const failing =
      rejection.orders.errors.length > 0
        ? { name: "orders.csv", ...rejection.orders }
        : { name: "payments.csv", ...rejection.payments };

    return (
      <div className="mx-auto w-full max-w-[600px] p-8">
        <h1 className="mb-4 text-lg font-semibold">Import rejected</h1>
        <div className="mb-4 flex gap-3 rounded-[9px] bg-[var(--severity-tint-critical)] px-4 py-3.5">
          <span className="mt-1.5 h-1.75 w-1.75 flex-none rounded-full bg-[var(--severity-critical)]" />
          <div>
            <p className="mb-1 text-[12.5px] font-semibold text-[var(--severity-critical)]">
              {failing.name} could not be read
            </p>
            <p className="text-[12.5px] leading-[19px] text-[var(--severity-critical)]">
              {failing.errors[0]}
            </p>
          </div>
        </div>
        {failing.columnsFound.length > 0 && (
          <div className="mb-4 rounded-[9px] border border-border bg-background px-3.5 py-3">
            <p className="mb-2 text-[11.5px] font-semibold text-muted-foreground">
              Found in your file
            </p>
            <p className="font-mono text-[11.5px] text-muted-foreground">
              {failing.columnsFound.join(", ")}
            </p>
          </div>
        )}
        <button
          onClick={reset}
          className="rounded-md bg-primary px-3.5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Upload a different file
        </button>
      </div>
    );
  }

  if (step === "check" && result) {
    return (
      <div className="p-7">
        <div className="mb-4.5 flex items-center gap-3.5">
          <StepBadge state="done" label="Upload files" />
          <div className="w-15 border-t border-ring" />
          <StepBadge state="now" label="Check the data" index={2} />
          <div className="w-15 border-t border-ring" />
          <StepBadge state="next" label="Reconcile" index={3} />
        </div>

        <div className="mb-4.5 flex gap-4">
          <FileCard name="orders.csv" summary={result.ordersSummary} />
          <FileCard name="payments.csv" summary={result.paymentsSummary} />
        </div>

        {isReconciling ? (
          <div className="mb-4.5 rounded-lg border border-border bg-card px-5 py-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[15px] font-semibold">
                Matching {result.ordersSummary.unique} orders against{" "}
                {result.paymentsSummary.unique} payments
              </p>
              <span className="font-mono text-[12.5px] text-muted-foreground">
                {Math.round(((reconcileStage + 1) / RECONCILE_STAGES.length) * 100)}%
              </span>
            </div>
            <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{
                  width: `${((reconcileStage + 1) / RECONCILE_STAGES.length) * 100}%`,
                }}
              />
            </div>
            {RECONCILE_STAGES.map((stage, index) => (
              <div key={stage} className="flex items-center gap-2.5 py-1 text-[13px]">
                <span
                  className={`h-2 w-2 flex-none rounded-full ${
                    index < reconcileStage
                      ? "bg-[var(--severity-reconciled)]"
                      : index === reconcileStage
                        ? "bg-primary"
                        : "bg-ring"
                  }`}
                />
                <span
                  className={
                    index <= reconcileStage ? "text-foreground" : "text-muted-foreground"
                  }
                >
                  {stage}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mb-4.5 rounded-lg border border-border bg-card">
            <div className="border-b border-border px-5 pt-4.5 pb-4">
              <h2 className="mb-1 text-[15px] font-semibold">
                What we found before reconciling
              </h2>
              <p className="text-[12.5px] text-muted-foreground">
                These are parsing decisions, not discrepancies. Each one
                changes what the engine sees.
              </p>
            </div>
            {result.findings.map((finding) => (
              <div
                key={finding.title}
                className="flex items-start gap-3 border-t border-border/60 px-5 py-3.5 first:border-t-0"
              >
                <span
                  className={`mt-1.5 h-1.75 w-1.75 flex-none rounded-full ${FINDING_DOT[finding.tone]}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-[13px] font-semibold">{finding.title}</p>
                  <p className="text-[12.5px] leading-[19px] text-muted-foreground">
                    {finding.description}
                  </p>
                </div>
                <code className="flex-none rounded bg-secondary px-2 py-1 font-mono text-[11px] text-muted-foreground">
                  {finding.tag}
                </code>
              </div>
            ))}
          </div>
        )}

        {reconcileError && (
          <p className="mb-3 text-sm text-destructive">{reconcileError}</p>
        )}

        <div className="flex items-center justify-between">
          <button
            onClick={reset}
            disabled={isReconciling}
            className="rounded-md border border-ring bg-white px-3.5 py-2.25 text-sm font-medium disabled:opacity-50"
          >
            Back to files
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              Reconciliation is deterministic — the same files always give
              the same result.
            </span>
            <button
              onClick={handleRunReconciliation}
              disabled={isReconciling}
              className="rounded-md bg-primary px-5 py-3 text-[13.5px] font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isReconciling ? "Reconciling…" : "Run reconciliation"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center px-15">
      <div className="w-[760px] text-center">
        <h1 className="mb-2.5 text-[28px] font-semibold tracking-tight">
          Nothing to reconcile yet
        </h1>
        <p className="mx-auto mb-6.5 max-w-[620px] text-[14.5px] leading-[23px] text-muted-foreground">
          Load the order export from your store and the settlement export
          from your payment processor. Ledgerline matches them line by line
          and reports every case where the two disagree.
        </p>
        <div className="mb-6.5 flex gap-4">
          <Dropzone
            label="Order export"
            columnsHint={ORDERS_COLUMNS_HINT}
            file={ordersFile}
            onFileSelected={setOrdersFile}
          />
          <Dropzone
            label="Payment export"
            columnsHint={PAYMENTS_COLUMNS_HINT}
            file={paymentsFile}
            onFileSelected={setPaymentsFile}
          />
        </div>
        {genericError && (
          <p className="mb-4 text-sm text-destructive">{genericError}</p>
        )}
        <button
          disabled={!ordersFile || !paymentsFile || isSubmitting}
          onClick={handleContinue}
          className="rounded-md bg-primary px-5 py-3 text-[13.5px] font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground"
        >
          {isSubmitting ? "Uploading…" : "Continue"}
        </button>
        <span className="mt-6.5 block text-xs text-muted-foreground">
          Both files are required. Everything you upload stays private to
          your account.
        </span>
      </div>
    </div>
  );
}

function StepBadge({
  state,
  label,
  index,
}: {
  state: "done" | "now" | "next";
  label: string;
  index?: number;
}) {
  const circleClass =
    state === "done"
      ? "bg-[var(--severity-reconciled)] text-white"
      : state === "now"
        ? "bg-primary text-primary-foreground"
        : "border border-ring bg-white text-muted-foreground";
  const textClass =
    state === "next"
      ? "text-muted-foreground"
      : state === "now"
        ? "font-semibold"
        : "";
  return (
    <div className={`flex items-center gap-2.5 text-[13px] font-medium ${textClass}`}>
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${circleClass}`}
      >
        {state === "done" ? <CheckCircle2 size={14} /> : index}
      </span>
      {label}
    </div>
  );
}

function FileCard({ name, summary }: { name: string; summary: FileSummary }) {
  return (
    <div className="flex-1 rounded-lg border border-border bg-card px-5 py-4.5">
      <div className="mb-2.5 flex items-center gap-2.5">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--severity-tint-reconciled)] text-[var(--severity-reconciled)]">
          <CheckCircle2 size={13} />
        </span>
        <span className="font-mono text-[13.5px] font-semibold">{name}</span>
      </div>
      <p className="text-[12.5px] leading-5 text-muted-foreground">
        {summary.rowsRead} rows read · {summary.unique} unique
        <br />
        {summary.columns} columns · {summary.dateFormat} dates
      </p>
    </div>
  );
}
