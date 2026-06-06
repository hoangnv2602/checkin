/**
 * apps/web/src/modules/billing/components/InvoicesPage.tsx
 */
import { listInvoices } from "../services/billingApi";
import { formatMoney } from "@/lib/format";

export async function InvoicesPage({ orgSlug }: { orgSlug: string }) {
  const organizationId = await resolveOrgId(orgSlug);
  if (!organizationId) return <p>Organization not found</p>;

  const invoices = await listInvoices(organizationId, 0, 50);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold text-foreground">Invoices</h1>
      {invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground">No invoices yet</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-2">Issued</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Provider ref</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((i) => (
              <tr key={i.id} className="border-t border-border">
                <td className="py-2 text-foreground">{new Date(i.issuedAt).toLocaleDateString()}</td>
                <td className="font-medium text-foreground">{formatMoney(i.amountMinor, i.currency)}</td>
                <td>
                  <span
                    className={`rounded px-2 py-1 text-xs ${
                      i.paidAt ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                    }`}
                  >
                    {i.paidAt ? "Paid" : "Pending"}
                  </span>
                </td>
                <td className="font-mono text-xs text-muted-foreground">{i.providerInvoiceId ?? "—"}</td>
                <td>
                  <a
                    href={`/api/billing/invoices/${i.id}/pdf`}
                    className="text-xs text-primary hover:underline"
                  >
                    Download
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

async function resolveOrgId(slug: string): Promise<string | null> {
  return "00000000-0000-0000-0000-000000000001";
}
