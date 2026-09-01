import { NextResponse } from "next/server";
import { computeFindings } from "@/lib/batches/findings";
import { orderToInsertRow, paymentToInsertRow } from "@/lib/batches/serialize";
import { parseOrdersCsv, parsePaymentsCsv } from "@/lib/csv/parse";
import { dedupeOrders } from "@/lib/reconciliation/group";
import { normalizeOrder, normalizePayment } from "@/lib/reconciliation/normalize";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const ordersFile = formData.get("orders");
  const paymentsFile = formData.get("payments");

  if (!(ordersFile instanceof File) || !(paymentsFile instanceof File)) {
    return NextResponse.json(
      { error: "Both an orders file and a payments file are required." },
      { status: 400 }
    );
  }

  const [ordersText, paymentsText] = await Promise.all([
    ordersFile.text(),
    paymentsFile.text(),
  ]);

  const ordersParsed = parseOrdersCsv(ordersText);
  const paymentsParsed = parsePaymentsCsv(paymentsText);

  if (ordersParsed.errors.length > 0 || paymentsParsed.errors.length > 0) {
    return NextResponse.json(
      {
        error: "validation_failed",
        orders: {
          errors: ordersParsed.errors,
          columnsFound: ordersParsed.columnsFound,
          columnsMissing: ordersParsed.columnsMissing,
        },
        payments: {
          errors: paymentsParsed.errors,
          columnsFound: paymentsParsed.columnsFound,
          columnsMissing: paymentsParsed.columnsMissing,
        },
      },
      { status: 400 }
    );
  }

  const normalizedOrders = ordersParsed.rows.map(normalizeOrder);
  const normalizedPayments = paymentsParsed.rows.map(normalizePayment);
  const { orders: dedupedOrders, duplicateOrderKeys } =
    dedupeOrders(normalizedOrders);

  const findings = computeFindings(
    normalizedOrders,
    duplicateOrderKeys,
    normalizedPayments
  );

  const { data: batch, error: batchError } = await supabase
    .from("import_batches")
    .insert({
      user_id: user.id,
      label: `Import · ${new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}`,
      orders_filename: ordersFile.name,
      payments_filename: paymentsFile.name,
      orders_row_count: dedupedOrders.length,
      payments_row_count: normalizedPayments.length,
      status: "pending",
    })
    .select("id")
    .single();

  if (batchError || !batch) {
    return NextResponse.json(
      { error: batchError?.message ?? "Failed to create import batch." },
      { status: 500 }
    );
  }

  const orderRows = dedupedOrders.map((o) =>
    orderToInsertRow(o, batch.id, user.id)
  );
  const paymentRows = normalizedPayments.map((p) =>
    paymentToInsertRow(p, batch.id, user.id)
  );

  const [ordersInsert, paymentsInsert] = await Promise.all([
    supabase.from("orders").insert(orderRows),
    supabase.from("payments").insert(paymentRows),
  ]);

  if (ordersInsert.error || paymentsInsert.error) {
    return NextResponse.json(
      {
        error:
          ordersInsert.error?.message ??
          paymentsInsert.error?.message ??
          "Failed to store the import.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      batchId: batch.id,
      ordersSummary: {
        rowsRead: ordersParsed.rows.length,
        unique: dedupedOrders.length,
        columns: ordersParsed.columnsFound.length,
        dateFormat: "ISO 8601",
      },
      paymentsSummary: {
        rowsRead: paymentsParsed.rows.length,
        unique: normalizedPayments.length,
        columns: paymentsParsed.columnsFound.length,
        dateFormat: "DD/MM/YYYY",
      },
      findings,
    },
    { status: 201 }
  );
}
