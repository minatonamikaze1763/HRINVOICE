const $ = (id) => document.getElementById(id);
const money = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
const value = (id) => $(id).value.trim();
const safe = (id, text) => {
  $(id).textContent = text || "—";
};
function numberToWords(num) {
  num = Math.round(num);
  if (num === 0) return "Zero";
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];
  function under1000(n) {
    let s = "";
    if (n >= 100) {
      s += ones[Math.floor(n / 100)] + " Hundred";
      n %= 100;
      if (n) s += " ";
    }
    if (n >= 20) {
      s += tens[Math.floor(n / 10)];
      if (n % 10) s += " " + ones[n % 10];
    } else if (n > 0) s += ones[n];
    return s;
  }
  let parts = [];
  const units = [
    [10000000, "Crore"],
    [100000, "Lakh"],
    [1000, "Thousand"],
    [1, ""],
  ];
  for (const [v, u] of units) {
    if (num >= v) {
      const q = Math.floor(num / v);
      parts.push(under1000(q) + (u ? " " + u : ""));
      num %= v;
    }
  }
  return parts.join(" ");
}
function update() {
  const ex = Math.max(0, parseFloat(value("exShowroom")) || 0);
  const cr = Math.max(0, parseFloat(value("cgstRate")) || 0),
    sr = Math.max(0, parseFloat(value("sgstRate")) || 0);
  // Ex-showroom price is treated as tax-inclusive; split it using the entered GST rates.
  const taxable = ex / (1 + (cr + sr) / 100);
  const cgst = (taxable * cr) / 100,
    sgst = (taxable * sr) / 100;
  const total = taxable + cgst + sgst;
  const fmtDate = value("date")
    ? new Date(value("date")).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";
  safe("pSeller", value("seller"));
  safe("pSellerAddress", value("sellerAddress"));
  safe(
    "pSellerState",
    value("sellerState") + " • State Code: " + (value("stateCode") || "—"),
  );
  safe("pDealer", value("dealer"));
  safe("pGSTIN", "GSTIN: " + (value("gstin") || "—"));
  safe(
    "pSellerPhone",
    value("sellerPhone") ? "Contact # " + value("sellerPhone") : "",
  );
  safe("pInvoiceNo", value("invoiceNo"));
  safe("pDate", fmtDate);
  safe("pSupply", value("supply"));
  safe("pContactId", value("contactId"));
  safe("pCustomer", value("customer"));
  safe("pRelation", value("relation"));
  safe("pAddress", value("address"));
  safe("pPhone", value("phone"));
  safe("pPayment", value("payment"));
  safe("pStateCode", value("stateCode"));
  safe("pModel", value("model"));
  safe("pVariantCode", value("variantCode"));
  safe("pVariantName", value("variantName"));
  safe("pColour", value("colour"));
  safe("pHsn", value("hsn"));
  safe("pUom", value("uom"));
  safe("pEngine", value("engine"));
  safe("pChassis", value("chassis"));
  safe("pCgstRate", cr + "%");
  safe("pSgstRate", sr + "%");
  safe("pTaxable", money(taxable));
  safe("pSubtotal", money(taxable));
  safe("pTaxable2", money(taxable));
  safe("pCgst", money(cgst));
  safe("pSgst", money(sgst));
  safe(
    "pCgstLabel",
    "CGST on " +
      taxable.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
  );
  safe(
    "pSgstLabel",
    "SGST on " +
      taxable.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
  );
  safe("pExShowroom", money(ex));
  safe("pGrand", money(total));
  safe("pWords", "Rupees " + numberToWords(total) + " Only");
  safe("pNote", value("note"));
  safe("pRemarks", value("remarks"));
  safe("pSignSeller", value("seller"));
  $("calcSummary").textContent =
    ex > 0
      ? `Calculated taxable value: ${money(taxable)} • CGST: ${money(cgst)} • SGST: ${money(sgst)} • Total: ${money(total)}`
      : "Enter ex-showroom price to calculate tax breakup.";
}
document
  .querySelectorAll("input,textarea,select")
  .forEach((el) => el.addEventListener("input", update));
$("printBtn").addEventListener("click", () => window.print());
$("clearBtn").addEventListener("click", () => {
  [
    "customer",
    "relation",
    "address",
    "phone",
    "invoiceNo",
    "contactId",
    "model",
    "variantCode",
    "variantName",
    "colour",
    "engine",
    "chassis",
    "exShowroom",
    "remarks",
  ].forEach((id) => ($(id).value = ""));
  update();
});
const now = new Date();
now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
$("date").value = now.toISOString().slice(0, 16);
update();
