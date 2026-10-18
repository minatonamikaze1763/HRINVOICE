const $ = (id) => document.getElementById(id);

let forceReload = false;

let downloadToastTimer = null;
let downloadToastRemaining = 3000;
let downloadToastStartedAt = 0;
let downloadToastIsPaused = false;

function showDownloadToast(message, type = "success", duration = 3000) {
  const toast = $("downloadToast");
  const messageElement = $("downloadToastMessage");
  const iconElement = $("downloadToastIcon");
  const closeButton = $("closeDownloadToast");

  if (!toast || !messageElement || !iconElement || !closeButton) return;

  const validTypes = ["info", "danger", "success", "loading"];
  if (!validTypes.includes(type)) type = "info";

  clearTimeout(downloadToastTimer);
  downloadToastTimer = null;

  downloadToastRemaining = Math.max(0, duration);
  downloadToastIsPaused = false;

  const icons = {
    info: "ℹ",
    danger: "✕",
    success: "✓",
    loading: "",
  };

  iconElement.textContent = icons[type];
  messageElement.textContent = message;

  toast.classList.remove(
    "hidden",
    "toast-active",
    "toast-info",
    "toast-danger",
    "toast-success",
    "toast-loading",
  );

  toast.classList.add(`toast-${type}`, "toast-active");

  if (type === "loading") {
    closeButton.classList.add("hidden");
    toast.classList.add("toast-persistent");
    return;
  }

  closeButton.classList.toggle("hidden", type === "info");
  toast.classList.remove("toast-persistent");

  // Only closable notifications pause on hover.
  if (type === "success" || type === "danger") {
    scheduleToastClose();
  } else {
    downloadToastTimer = setTimeout(hideDownloadToast, downloadToastRemaining);
  }
}

function scheduleToastClose() {
  clearTimeout(downloadToastTimer);

  if (downloadToastIsPaused) return;

  downloadToastStartedAt = Date.now();

  downloadToastTimer = setTimeout(() => {
    hideDownloadToast();
  }, downloadToastRemaining);
}

function pauseDownloadToast() {
  const toast = $("downloadToast");
  if (!toast || toast.classList.contains("hidden")) return;

  const isClosable =
    toast.classList.contains("toast-success") ||
    toast.classList.contains("toast-danger");

  if (!isClosable || downloadToastIsPaused) return;

  clearTimeout(downloadToastTimer);
  downloadToastTimer = null;

  const elapsed = Date.now() - downloadToastStartedAt;
  downloadToastRemaining = Math.max(0, downloadToastRemaining - elapsed);

  downloadToastIsPaused = true;
}

function resumeDownloadToast() {
  const toast = $("downloadToast");
  if (!toast || toast.classList.contains("hidden")) return;
  if (!downloadToastIsPaused) return;

  downloadToastIsPaused = false;
  scheduleToastClose();
}

function hideDownloadToast() {
  const toast = $("downloadToast");

  clearTimeout(downloadToastTimer);
  downloadToastTimer = null;
  downloadToastIsPaused = false;
  downloadToastRemaining = 3000;

  if (!toast) return;

  toast.classList.add("hidden");
  toast.classList.remove("toast-active", "toast-persistent");
}

// Attach hover and close handlers once the elements exist.
const downloadToastElement = $("downloadToast");
const closeDownloadToast = $("closeDownloadToast");

if (downloadToastElement) {
  downloadToastElement.addEventListener("mouseenter", pauseDownloadToast);

  downloadToastElement.addEventListener("mouseleave", resumeDownloadToast);
}

if (closeDownloadToast) {
  closeDownloadToast.onclick = hideDownloadToast;
}

function notifySuccess(message, duration = 3000) {
  showDownloadToast(message, "success", duration);
}

function notifyError(message, duration = 5000) {
  showDownloadToast(message, "danger", duration);
}

function notifyInfo(message, duration = 3000) {
  showDownloadToast(message, "info", duration);
}

function notifyLoading(message) {
  showDownloadToast(message, "loading");
}

function notifyDraftSaved() {
  notifySuccess("Invoice draft saved");
}

function notifyDraftRestored() {
  notifyInfo("Previous invoice details restored");
}

function notifyPDFReady(filename) {
  notifySuccess(`Download started: ${filename}`);
}

function notifyImportError(message) {
  notifyError(`Import failed: ${message}`, 5000);
}

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
/* ==========================================
   INPUT SANITIZATION — TOP LEVEL
========================================== */

function normalizeInvoiceNumber() {
  const field = $("invoiceNo");
  if (!field) return;

  field.value = field.value.replace(/\D/g, "").slice(0, 4);
  field.maxLength = 4;
  field.inputMode = "numeric";
}

// Name and S/O: English letters and spaces only.
function sanitizeNameField(field) {
  field.value = field.value.replace(/[^a-zA-Z ]/g, "").replace(/\s{2,}/g, " ");
}

// Mobile: numbers only, plus sign allowed only at the beginning.
function sanitizeMobileField(field) {
  const raw = field.value;

  const digits = raw.replace(/\D/g, "").slice(0, 10);
  const hasLeadingPlus = raw.trimStart().startsWith("+");

  field.value = (hasLeadingPlus ? "+" : "") + digits;
}

function installInputSanitizers() {
  const invoiceNumberField = $("invoiceNo");

  if (invoiceNumberField) {
    invoiceNumberField.addEventListener("input", normalizeInvoiceNumber);
    normalizeInvoiceNumber();
  }

  ["customer", "relation"].forEach((id) => {
    const field = $(id);
    if (!field || field.dataset.sanitizerInstalled) return;

    field.dataset.sanitizerInstalled = "true";

    field.addEventListener("input", () => {
      const oldValue = field.value;
      const cursor = field.selectionStart;

      sanitizeNameField(field);

      // Keep the cursor near its original position.
      if (oldValue !== field.value && cursor !== null) {
        const cleanedBeforeCursor = oldValue
          .slice(0, cursor)
          .replace(/[^a-zA-Z ]/g, "")
          .replace(/\s{2,}/g, " ");

        const newPosition = Math.min(
          cleanedBeforeCursor.length,
          field.value.length,
        );

        field.setSelectionRange(newPosition, newPosition);
      }

      update();
      scheduleInvoiceDraftSave();
      updatePageTitle();
    });

    // Also sanitize pasted or restored values.
    sanitizeNameField(field);
  });

  const phoneField = $("phone");

  if (phoneField && !phoneField.dataset.sanitizerInstalled) {
    phoneField.dataset.sanitizerInstalled = "true";

    phoneField.addEventListener("input", () => {
      sanitizeMobileField(phoneField);
      update();
      scheduleInvoiceDraftSave();
    });

    sanitizeMobileField(phoneField);
  }

  update();
}

// Install after the HTML fields exist.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", installInputSanitizers, {
    once: true,
  });
} else {
  installInputSanitizers();
}
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
  safe("pInvoiceNo", "10175BJ26S" + value("invoiceNo"));
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

/* Keep the invoice preview synchronized with form fields */
document.querySelectorAll("input, textarea, select").forEach((el) => {
  el.addEventListener("input", update);
  el.addEventListener("change", update);
});

/* ==========================================
   REQUIRED FIELD VALIDATION
========================================== */

function validateInvoiceFields() {
  const requiredFields = [
    ["customer", "Customer name"],
    ["relation", "Customer S/O or relation"],
    ["address", "Customer address"],
    ["phone", "Customer phone"],
    ["date", "Invoice date"],
    ["invoiceNo", "Invoice number"],
    ["payment", "Hypothecation / payment method"],
    ["supply", "Place of supply"],
    ["model", "Vehicle model"],
    ["variantCode", "Variant code"],
    ["variantName", "Variant name / description"],
    ["colour", "Vehicle colour"],
    ["hsn", "HSN code"],
    ["uom", "UOM"],
    ["engine", "Engine number"],
    ["chassis", "Chassis number"],
    ["exShowroom", "Ex-showroom price"],
    ["cgstRate", "CGST rate"],
    ["sgstRate", "SGST rate"],
  ];

  const missing = [];

  for (const [id, label] of requiredFields) {
    const el = $(id);

    if (!el || !el.value.trim()) {
      missing.push(label);
    }
  }

  // Validate the payment dropdown.
  if (!$("payment").value) {
    if (!missing.includes("Hypothecation / payment method")) {
      missing.push("Hypothecation / payment method");
    }
  }
  // Validate customer phone number (exactly 10 digits).
  const phone = value("phone").replace(/\D/g, "");

  if (value("phone").trim() && phone.length !== 10) {
    missing.push("Customer phone must contain exactly 10 digits");
  }
  // Validate the date.
  if (value("date") && Number.isNaN(Date.parse(value("date")))) {
    missing.push("Valid invoice date");
  }

  // Validate the ex-showroom price.
  const price = Number(value("exShowroom"));

  if (value("exShowroom") && (!Number.isFinite(price) || price <= 0)) {
    missing.push("Ex-showroom price must be greater than zero");
  }

  // Validate tax rates.
  for (const [id, label] of [
    ["cgstRate", "CGST rate"],
    ["sgstRate", "SGST rate"],
  ]) {
    const el = $(id);
    const rate = Number(value(id));

    if (
      el &&
      value(id) !== "" &&
      (!Number.isFinite(rate) ||
        rate < 0 ||
        rate > 100 ||
        el.validity.badInput ||
        el.validity.stepMismatch)
    ) {
      missing.push(label + " must be between 0 and 100");
    }
  }

  if (missing.length) {
    alert(
      "Invoice cannot be generated yet.\n\n" +
        "Please complete or correct these fields:\n\n" +
        [...new Set(missing)].map((item) => "• " + item).join("\n"),
    );

    // Focus the first missing field when possible.
    const firstMissing = requiredFields.find(
      ([id, label]) => missing.includes(label) && $(id) && !$(id).value.trim(),
    );

    if (firstMissing) {
      $(firstMissing[0]).focus();
    }

    return false;
  }

  return true;
}

/* ==========================================
   PRINT / SAVE PDF
========================================== */

$("printBtn").addEventListener("click", () => {
  if (!validateInvoiceFields()) return;

  update();
  window.print();
});

$("clearBtn").addEventListener("click", () => {
  if (!confirm("Are you sure you want to clear the form and reload?")) {
    notifyInfo("Form clearing cancelled");
    return;
  }

  notifyInfo("Clearing invoice form...");
  [
    "customer",
    "relation",
    "address",
    "phone",
    "model",
    "variantCode",
    "variantName",
    "colour",
    "engine",
    "chassis",
    "exShowroom",
    "payment",
    "insuranceIdv",
  ].forEach((id) => {
    const field = $(id);
    if (field) field.value = "";
  });

  // Reset the invoice date to the current local date and time
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());

  const dateField = $("date");

  if (dateField) {
    if (dateField.type === "datetime-local") {
      dateField.value = now.toISOString().slice(0, 16);
    } else if (dateField.type === "date") {
      dateField.value = now.toISOString().slice(0, 10);
    }
  }

  // Refresh the invoice preview after all field changes
  update();
  // Reload the page with a fresh invoice date and empty customer details.
  window.location.reload();
});

/* ==========================================
   FORM 22 + INVOICE ZIP GENERATOR
   Uses the existing 22.pdf template.
========================================== */

/*
  IMPORTANT:
  Fill the x and y coordinates after checking 22.pdf.

  PDF coordinate system:
  - x = distance from the left edge
  - y = distance from the bottom edge
  - Units = PDF points (72 points = 1 inch)

  The same coordinates are used on BOTH pages.
*/
const FORM22_COORDS = {
  model: {
    label: "Model",
    x: 351,
    y: 600,

    fontSize: 8,
  },

  variantDescription: {
    label: "Variant Description",
    x: 320,
    y: 585,
    fontSize: 8,
  },

  chassisNumber: {
    label: "Chassis Number",
    x: 358,
    y: 570,
    fontSize: 8,
  },

  engineNumber: {
    label: "Engine Number",
    x: 358,
    y: 550,
    fontSize: 8,
  },
};

/*
  Map the existing invoice input IDs to Form 22.
  No duplicate data-entry fields are needed.
*/
function getForm22Data() {
  return {
    model: ": " + value("model"),
    variantDescription: ": " + value("variantName"),
    chassisNumber: ": " + value("chassis"),
    engineNumber: ": " + value("engine"),
  };
}

/*
  Check that every coordinate has been configured.
  Prevents accidentally generating a blank or misplaced Form 22.
*/
function validateForm22Coordinates() {
  const missing = Object.entries(FORM22_COORDS)
    .filter(
      ([, position]) =>
        !Number.isFinite(position.x) || !Number.isFinite(position.y),
    )
    .map(([, position]) => position.label);

  if (missing.length) {
    throw new Error("Set the Form 22 coordinates first: " + missing.join(", "));
  }
}

/*
  Generate Form 22 using the original two-page PDF.
  Both pages receive the same four fields at the same
  coordinates. Existing printed copy labels and layout
  remain part of the original template.
*/
async function generateForm22PDF() {
  validateForm22Coordinates();

  const data = getForm22Data();

  const form22File = $("evVehicle")?.checked ? "./ev22.pdf" : "./22.pdf";

  const response = await fetch(form22File, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      "Could not load 22.pdf. Make sure it is in the project root.",
    );
  }

  const templateBytes = await response.arrayBuffer();

  const pdfDoc = await PDFLib.PDFDocument.load(templateBytes);

  const pages = pdfDoc.getPages();

  if (pages.length !== 2) {
    throw new Error(
      `Expected a 2-page Form 22 template, but found ${pages.length} page(s).`,
    );
  }

  const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);

  // Apply the exact same field positions to both pages.
  for (const page of pages) {
    for (const [fieldName, position] of Object.entries(FORM22_COORDS)) {
      const text = String(data[fieldName] || "").trim();

      if (!text) continue;

      page.drawText(text, {
        x: position.x,
        y: position.y,
        size: position.fontSize,
        font,
        color: PDFLib.rgb(0, 0, 0),
        maxWidth: page.getWidth() - position.x - 20,
      });
    }
  }

  const pdfBytes = await pdfDoc.save();

  return new Blob([pdfBytes], {
    type: "application/pdf",
  });
}

/*
  Export the existing invoice preview as a PDF Blob.
  The existing invoice layout and its CSS remain in use.
*/

async function generateInvoicePDF() {
  const invoiceElement = $("invoice");

  if (!invoiceElement) {
    throw new Error('Invoice preview element "#invoice" was not found.');
  }

  const rect = invoiceElement.getBoundingClientRect();

  if (
    invoiceElement.offsetWidth === 0 ||
    invoiceElement.offsetHeight === 0 ||
    rect.width === 0 ||
    rect.height === 0
  ) {
    throw new Error("Invoice preview is hidden or has zero dimensions.");
  }

  // Wait for the invoice preview to finish rendering.
  await new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)),
  );

  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  // Wait for invoice images to load.
  const images = Array.from(invoiceElement.querySelectorAll("img"));

  await Promise.all(
    images.map(async (img) => {
      if (!img.complete) {
        await new Promise((resolve) => {
          img.addEventListener("load", resolve, { once: true });
          img.addEventListener("error", resolve, { once: true });
        });
      }

      if (img.decode && img.naturalWidth > 0) {
        try {
          await img.decode();
        } catch (_) {}
      }
    }),
  );

  // Load html2canvas if it is not already available.
  if (typeof window.html2canvas !== "function") {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");

      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";

      script.onload = resolve;
      script.onerror = () => reject(new Error("Could not load html2canvas."));

      document.head.appendChild(script);
    });
  }

  // Capture the invoice as a high-resolution PNG canvas.
  const canvas = await window.html2canvas(invoiceElement, {
    scale: 3,
    backgroundColor: "#ffffff",
    useCORS: true,
    allowTaint: false,
    logging: false,
    width: invoiceElement.scrollWidth,
    height: invoiceElement.scrollHeight,
    windowWidth: Math.max(
      document.documentElement.clientWidth,
      invoiceElement.scrollWidth,
    ),
    onclone: (clonedDocument) => {
      const clonedInvoice = clonedDocument.getElementById("invoice");

      if (clonedInvoice) {
        Object.assign(clonedInvoice.style, {
          display: "block",
          visibility: "visible",
          opacity: "1",
          backgroundColor: "#ffffff",
          color: "#000000",
          height: "auto",
          maxHeight: "none",
          overflow: "visible",
        });
      }
    },
  });

  if (!canvas.width || !canvas.height) {
    throw new Error("Invoice PNG generation returned an empty canvas.");
  }

  // Convert the canvas to a PNG blob.
  const pngBlob = await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Could not convert the invoice canvas to PNG."));
      }
    }, "image/png");
  });

  if (pngBlob.size < 500) {
    throw new Error("The generated invoice PNG is empty or invalid.");
  }

  // Create an A4 portrait PDF from the PNG.
  if (!window.PDFLib) {
    throw new Error("pdf-lib did not load.");
  }

  const pdfDoc = await PDFLib.PDFDocument.create();

  const A4_WIDTH = 595.28;
  const A4_HEIGHT = 841.89;
  const margin = 18;

  const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);

  const pngBytes = await pngBlob.arrayBuffer();
  const embeddedPng = await pdfDoc.embedPng(pngBytes);

  // Fit the entire invoice image onto one A4 page,
  // preserving its aspect ratio without stretching.
  const availableWidth = A4_WIDTH - margin * 2;
  const availableHeight = A4_HEIGHT - margin * 2;

  const scale = Math.min(
    availableWidth / embeddedPng.width,
    availableHeight / embeddedPng.height,
  );

  const drawWidth = embeddedPng.width * scale;
  const drawHeight = embeddedPng.height * scale;

  page.drawImage(embeddedPng, {
    x: (A4_WIDTH - drawWidth) / 2,
    y: (A4_HEIGHT - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
  });

  const pdfBytes = await pdfDoc.save();

  const pdfBlob = new Blob([pdfBytes], {
    type: "application/pdf",
  });

  if (pdfBlob.size < 500) {
    throw new Error("Invoice PDF generation failed.");
  }

  const signature = await pdfBlob.slice(0, 5).text();

  if (signature !== "%PDF-") {
    throw new Error("The generated invoice PDF is invalid.");
  }

  console.log(`Invoice PNG generated: ${pngBlob.size} bytes`);

  console.log(`Invoice PDF generated: ${pdfBlob.size} bytes`);

  return pdfBlob;
}

async function generateInvoiceAndForm22ZIP() {
  const button = $("generateBundleBtn");

  if (button.disabled) return;

  const originalText = button.textContent;

  button.disabled = true;
  button.textContent = "Generating PDFs...";
  // Persistent loading notification: no close button or timer.
  showDownloadToast("Generating Invoice + Form 22 ZIP...", "loading");
  try {
    // Refresh invoice preview from the latest input values.
    update();

    if (!window.PDFLib) {
      throw new Error("pdf-lib did not load.");
    }

    if (!window.JSZip) {
      throw new Error("JSZip did not load.");
    }

    if (typeof window.html2pdf !== "function") {
      throw new Error("html2pdf.js did not load.");
    }

    // Generate both files.
    const [form22Blob, invoiceBlob] = await Promise.all([
      generateForm22PDF(),
      generateInvoicePDF(),
    ]);

    // Package them into a ZIP.
    const zip = new JSZip();

    zip.file("Form22.pdf", form22Blob);
    zip.file("Invoice.pdf", invoiceBlob);

    const zipBlob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: {
        level: 6,
      },
    });

    // Trigger the ZIP download.
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement("a");

    const invoiceNumber = value("invoiceNo") || "Invoice";
    const zipFilename = `${invoiceNumber}_Invoice_Form22.zip`;
    link.href = url;
    link.download = zipFilename;

    document.body.appendChild(link);
    link.click();
    link.remove();
    // Show the download confirmation.
    showDownloadToast(`${zipFilename} downloaded successfully`, "success");

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    console.error("Invoice/Form 22 ZIP generation failed:", error);
    notifyError(
      `ZIP generation failed: ${error.message || "Unknown error"}`,
      6000,
    );
    alert(
      "Could not generate the ZIP.\n\n" +
        error.message +
        "\n\nCheck the browser console for more details.",
    );
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

$("generateBundleBtn").addEventListener("click", generateInvoiceAndForm22ZIP);

/* ==========================================
   INVOICE AUTO-SAVE + RELOAD PROTECTION
========================================== */

const DRAFT_STORAGE_KEY = "ndc_invoice_draft_v1";

let draftSaveTimer = null;
let isRestoringDraft = false;

// Collect entered form values.

function collectInvoiceDraft() {
  const draft = {};

  document
    .querySelectorAll("input[id], textarea[id], select[id]")
    .forEach((el) => {
      // Never save the invoice date in localStorage.
      if (el.id === "date") return;
      if (el.id === "includeSignStamp") return;
      if (el.id === "evVehicle") return;
      if (el.id === "cgstRate") return;
      if (el.id === "sgstRate") return;
      // File inputs and passwords cannot be restored safely.
      if (el.type === "file" || el.type === "password") return;

      if (el.type === "checkbox" || el.type === "radio") {
        draft[el.id] = {
          type: el.type,
          checked: el.checked,
          value: el.value,
        };
      } else {
        draft[el.id] = {
          type: el.type,
          value: el.value,
        };
      }
    });

  return draft;
}

// Save current form values locally in this browser.
function saveInvoiceDraft() {
  if (isRestoringDraft) return;

  try {
    const draft = collectInvoiceDraft();

    localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({
        savedAt: new Date().toISOString(),
        fields: draft,
      }),
    );

    console.log("Invoice draft auto-saved.");
  } catch (error) {
    console.error("Could not save invoice draft:", error);
  }
}

// Debounce frequent keystrokes slightly.
function scheduleInvoiceDraftSave() {
  if (isRestoringDraft) return;

  clearTimeout(draftSaveTimer);

  draftSaveTimer = setTimeout(saveInvoiceDraft, 150);
}

// Restore previously saved values.
function restoreInvoiceDraft() {
  let saved;

  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);

    if (!raw) return false;

    saved = JSON.parse(raw);

    if (!saved || !saved.fields) return false;
  } catch (error) {
    console.error("Could not read saved invoice draft:", error);
    return false;
  }

  isRestoringDraft = true;

  try {
    Object.entries(saved.fields).forEach(([id, field]) => {
      const el = $(id);
      if (id === "includeSignStamp") return;
      if (id === "evVehicle") return;
      if (id === "cgstRate") return;
      if (id === "sgstRate") return;
      if (!el || !field) return;
      if (el.type === "file" || el.type === "password") return;

      if (el.type === "checkbox" || el.type === "radio") {
        el.checked = Boolean(field.checked);
      } else if (typeof field.value === "string") {
        // Do not overwrite a field with an incompatible input type.
        el.value = field.value;
      }
    });
  } finally {
    isRestoringDraft = false;
  }

  console.log(
    "Invoice draft restored.",
    saved.savedAt ? "Last saved: " + saved.savedAt : "",
  );

  return true;
}

// Restore all saved invoice fields except the date.
const invoiceDraftRestored = restoreInvoiceDraft();
if (invoiceDraftRestored) {
  notifyDraftRestored();
}
// Always initialize the invoice date using the current local time.
function setCurrentInvoiceDate() {
  const dateField = $("date");
  if (!dateField) return;

  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());

  if (dateField.type === "datetime-local") {
    dateField.value = now.toISOString().slice(0, 16);
  } else if (dateField.type === "date") {
    dateField.value = now.toISOString().slice(0, 10);
  }

  // Update the printed invoice preview.
  update();
}

setCurrentInvoiceDate();

// Save changes made to any form field.
document.addEventListener("input", scheduleInvoiceDraftSave);
document.addEventListener("change", scheduleInvoiceDraftSave);

// Save immediately when the page becomes hidden or is closed.
window.addEventListener("pagehide", () => {
  clearTimeout(draftSaveTimer);
  saveInvoiceDraft();
});

// Warn before an accidental reload or tab close.
window.addEventListener("beforeunload", (event) => {
  // Ensure the latest values are saved before leaving.
  clearTimeout(draftSaveTimer);
  saveInvoiceDraft();

  event.preventDefault();
  event.returnValue = "";
});

// Optional: clear the saved draft when deliberately starting fresh.
function deleteSavedInvoiceDraft() {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch (error) {
    console.error("Could not delete saved draft:", error);
  }
}

// Automatically calculate ex-showroom price from Insurance IDV.
// IDV = 95% of ex-showroom price.
$("insuranceIdv").addEventListener("input", () => {
  const idvField = $("insuranceIdv");
  const exShowroomField = $("exShowroom");

  if (idvField.value.trim() === "") {
    update();
    return;
  }

  const idv = Number(idvField.value);

  if (Number.isFinite(idv) && idv > 0) {
    exShowroomField.value = (idv / 0.95).toFixed(2);
  } else {
    exShowroomField.value = "";
  }

  // Refresh tax calculations and the invoice preview.
  update();
});

/* =========================================
   NDC INVOICE SYSTEM — KEYBOARD SHORTCUTS
   Ctrl + X = Clear Form and Reload
   Ctrl + S = Generate Invoice + Form 22 ZIP
========================================= */

document.addEventListener("keydown", function (event) {
  // Ignore shortcuts while the user is using browser/system
  // combinations involving Alt or the Windows/Command key.
  if (!event.ctrlKey || event.altKey || event.metaKey) return;

  const key = event.key.toLowerCase();

  // Ctrl + e: Clear Form and Reload
  if (key === "e") {
    event.preventDefault();

    const clearButton = document.getElementById("clearBtn");

    if (clearButton && !clearButton.disabled) {
      clearButton.click();
    }
  }

  // Ctrl + S: Generate Invoice + Form 22 ZIP
  if (key === "s") {
    event.preventDefault();

    const generateButton = document.getElementById("generateBundleBtn");

    if (generateButton && !generateButton.disabled) {
      if (!validateInvoiceFields()) return;
      generateButton.click();
    }
  }
  if (key === "p") {
    event.preventDefault();
    if (!validateInvoiceFields()) return;
    window.print();
  }
});

const customerInput = $("customer");

function updatePageTitle() {
  const customerName = customerInput.value.trim();

  document.title = customerName
    ? `INVOICE-${customerName}`
    : "NDC INVOICE SYSTEM";
}

const payment = $("payment");
const hpfeild = $("hpfeild");

function toggleHpField() {
  hpfeild.classList.toggle("hidden", payment.value === "---");
}

payment.addEventListener("change", toggleHpField);

// Apply on page load
toggleHpField();

/* ==========================================
   SESSION-ONLY SIGNATURE STAMP TOGGLE
========================================== */

const includeSignStamp = $("includeSignStamp");
const signStampImage = $("signStampImage");

function toggleSignStamp(showNotification = false) {
  if (!includeSignStamp || !signStampImage) return;

  signStampImage.classList.toggle("hidden", !includeSignStamp.checked);
  if (showNotification) {
    notifyInfo(
      includeSignStamp.checked
        ? "Signature stamp included"
        : "Signature stamp excluded",
    );
  }
}

if (includeSignStamp && signStampImage) {
  // Default checked state comes from index.html.
  toggleSignStamp();

  // Apply changes immediately to the invoice preview.
  includeSignStamp.addEventListener("change", toggleSignStamp);
}

/* ==========================================
   EV VEHICLE — GST RATE TOGGLE
========================================== */

const evVehicle = $("evVehicle");
const cgstRate = $("cgstRate");
const sgstRate = $("sgstRate");

function updateGSTRates() {
  const isEV = evVehicle.checked;

  const rate = isEV ? 2.5 : 9;

  cgstRate.value = rate;
  sgstRate.value = rate;

  update();
  scheduleInvoiceDraftSave();
  notifyInfo(
    isEV
      ? "EV mode enabled — CGST 2.5% and SGST 2.5%"
      : "Standard mode enabled — CGST 9% and SGST 9%",
  );
}

if (evVehicle && cgstRate && sgstRate) {
  evVehicle.addEventListener("change", updateGSTRates);
}
