const fs = require("fs");
const path = require("path");

const toVisibleKey = (text) => {
  const value = String(text).trim();
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return `${slug}_${(hash >>> 0).toString(36)}`;
};

/** [en, ar, id] — recurring-specific or overrides when CI copy differs */
const manualEntries = [
  ["Edit recurring invoice", "تعديل الفاتورة المتكررة", "Edit faktur berulang"],
  [
    "Invalid recurring profile data.",
    "بيانات الملف المتكرر غير صالحة.",
    "Data profil berulang tidak valid.",
  ],
  [
    "Invoice recurrence is required.",
    "تكرار الفاتورة مطلوب.",
    "Pengulangan faktur wajib diisi.",
  ],
  [
    "Start date is required.",
    "تاريخ البدء مطلوب.",
    "Tanggal mulai wajib diisi.",
  ],
  [
    "End date is required unless Never expire is checked.",
    "تاريخ الانتهاء مطلوب ما لم يتم تحديد «لا ينتهي أبداً».",
    "Tanggal akhir wajib diisi kecuali «Tidak pernah kedaluwarsa» dicentang.",
  ],
  [
    "End date must be on or after start date.",
    "يجب أن يكون تاريخ الانتهاء في أو بعد تاريخ البدء.",
    "Tanggal akhir harus pada atau setelah tanggal mulai.",
  ],
  [
    "Repeat interval must be at least 1.",
    "يجب أن تكون فترة التكرار 1 على الأقل.",
    "Interval pengulangan minimal 1.",
  ],
  [
    "Customer must have an email before saving with “Email customer on each run”.",
    "يجب أن يكون للعميل بريد إلكتروني قبل الحفظ مع «إرسال بريد للعميل في كل تشغيل».",
    "Pelanggan harus memiliki email sebelum menyimpan dengan «Email pelanggan setiap jalan».",
  ],
  [
    "Profile saved but custom fields failed to save.",
    "تم حفظ الملف لكن فشل حفظ الحقول المخصصة.",
    "Profil disimpan tetapi field kustom gagal disimpan.",
  ],
  [
    "Recurring profile was saved, but the first customer invoice was not created (start date is today): {{error}}",
    "تم حفظ الملف المتكرر، لكن لم يتم إنشاء أول فاتورة عميل (تاريخ البدء هو اليوم): {{error}}",
    "Profil berulang disimpan, tetapi faktur pelanggan pertama tidak dibuat (tanggal mulai hari ini): {{error}}",
  ],
  [
    "Recurring profile saved. Customer invoice {{number}} was created and emailed (start date is today).",
    "تم حفظ الملف المتكرر. تم إنشاء فاتura العميل {{number}} وإرسالها بالبريد (تاريخ البدء هو اليوم).",
    "Profil berulang disimpan. Faktur pelanggan {{number}} dibuat dan dikirim email (tanggal mulai hari ini).",
  ],
  [
    "Recurring profile saved. Customer invoice {{number}} was created as draft (start date is today).",
    "تم حفظ الملف المتكرر. تم إنشاء فاتura العميل {{number}} كمسودة (تاريخ البدء هو اليوم).",
    "Profil berulang disimpan. Faktur pelanggan {{number}} dibuat sebagai draf (tanggal mulai hari ini).",
  ],
  [
    "Recurring profile updated. Future runs will email the customer.",
    "تم تحديث الملف المتكرر. سيتم إرسال بريد للعميل في التشغيلات القادمة.",
    "Profil berulang diperbarui. Jalan berikutnya akan mengirim email ke pelanggan.",
  ],
  [
    "Recurring profile updated.",
    "تم تحديث الملف المتكرر.",
    "Profil berulang diperbarui.",
  ],
  [
    "Recurring profile saved. Future runs will email the customer.",
    "تم حفظ الملف المتكرر. سيتم إرسال بريد للعميل في التشغيلات القادمة.",
    "Profil berulang disimpan. Jalan berikutnya akan mengirim email ke pelanggan.",
  ],
  [
    "Recurring profile saved.",
    "تم حفظ الملف المتكرر.",
    "Profil berulang disimpan.",
  ],
  [
    "PDF template selected successfully! You can now save or send the invoice.",
    "تم اختيار قالب PDF بنجاح! يمكنك الآن حفظ أو إرسال الفاتورة.",
    "Template PDF berhasil dipilih! Anda sekarang dapat menyimpan atau mengirim faktur.",
  ],
  [
    "Loading profile…",
    "جارٍ تحميل الملف…",
    "Memuat profil…",
  ],
  [
    "Invoice recurrence",
    "تكرار الفاتورة",
    "Pengulangan faktur",
  ],
  [
    "Select saved schedule",
    "اختر جدولاً محفوظاً",
    "Pilih jadwal tersimpan",
  ],
  [
    "Search schedules…",
    "البحث في الجداول…",
    "Cari jadwal…",
  ],
  ["Start on", "يبدأ في", "Mulai pada"],
  ["End on", "ينتهي في", "Berakhir pada"],
  ["Never expire", "لا ينتهي أبداً", "Tidak pernah kedaluwarsa"],
  [
    "Recurring invoice numbering is not configured for this business group. Numbers will be auto-generated using the Business Group fallback sequence.",
    "ترقيم الفواتير المتكررة غير مُعدّ لهذه المجموعة. سيتم إنشاء الأرقام تلقائياً باستخدام تسلسل المجموعة الاحتياطي.",
    "Penomoran faktur berulang belum dikonfigurasi untuk grup bisnis ini. Nomor akan dibuat otomatis menggunakan urutan cadangan Grup Bisnis.",
  ],
  [
    "Recurring Invoice No",
    "رقم الفاتورة المتكررة",
    "No. Faktur Berulang",
  ],
  [
    "System-assigned profile number (immutable after save).",
    "رقم ملف مُخصص من النظام (لا يمكن تغييره بعد الحفظ).",
    "Nomor profil dari sistem (tidak dapat diubah setelah disimpan).",
  ],
  [
    "Configure Settings → Document Numbering to drive this prefix per Business Group.",
    "اضبط الإعدادات ← ترقيم المستندات لتحديد هذا البادئة لكل مجموعة أعمال.",
    "Atur Pengaturan → Penomoran Dokumen untuk mengatur awalan ini per Grup Bisnis.",
  ],
  [
    "Pre-filled from Settings → Document Numbering for this Business Group.",
    "مُعبأ مسبقاً من الإعدادات ← ترقيم المستندات لهذه المجموعة.",
    "Diisi otomatis dari Pengaturan → Penomoran Dokumen untuk Grup Bisnis ini.",
  ],
  [
    "e.g. Acme monthly retainer",
    "مثال: اشتراك شهري لـ Acme",
    "mis. retainer bulanan Acme",
  ],
  [
    "e.g. Monthly subscription invoice",
    "مثال: فاتورة اشتراك شهرية",
    "mis. faktur langganan bulanan",
  ],
  ["Save preference", "تفضيل الحفظ", "Preferensi simpan"],
  [
    "Choose what happens when you use Save below.",
    "اختر ما يحدث عند استخدام «حفظ» أدناه.",
    "Pilih apa yang terjadi saat Anda menggunakan Simpan di bawah.",
  ],
  ["(optional)", "(اختياري)", "(opsional)"],
  [
    "Open save preference options",
    "فتح خيارات تفضيل الحفظ",
    "Buka opsi preferensi simpan",
  ],
  [
    "Save as draft",
    "حفظ كمسودة",
    "Simpan sebagai draf",
  ],
  [
    "Save and send",
    "حفظ وإرسال",
    "Simpan dan kirim",
  ],
  [
    "New invoices from this profile stay as drafts until you send them.",
    "تبقى الفواتير الجديدة من هذا الملف مسودات حتى ترسلها.",
    "Faktur baru dari profil ini tetap draf sampai Anda mengirimnya.",
  ],
  [
    "Email the customer when invoices are generated (needs a valid customer email).",
    "إرسال بريد للعميل عند إنشاء الفواتير (يتطلب بريداً إلكترونياً صالحاً للعميل).",
    "Email pelanggan saat faktur dibuat (memerlukan email pelanggan yang valid).",
  ],
  [
    "Keep generated invoices as drafts; send them manually when ready.",
    "احتفظ بالفواتير المُنشأة كمسودات؛ أرسلها يدوياً عند الجاهزية.",
    "Simpan faktur yang dibuat sebagai draf; kirim manual saat siap.",
  ],
  [
    "Email the customer when each invoice is created from this schedule.",
    "إرسال بريد للعميل عند إنشاء كل فatura من هذا الجدول.",
    "Email pelanggan saat setiap faktur dibuat dari jadwal ini.",
  ],
  [
    "Terms appear on the invoice preview and PDF. Edit above if needed.",
    "تظهر الشروط في معاينة الفاتورة وPDF. عدّل أعلاه إذا لزم.",
    "Ketentuan muncul di pratinjau faktur dan PDF. Edit di atas jika perlu.",
  ],
  [
    "Template: {{name}}",
    "القالب: {{name}}",
    "Template: {{name}}",
  ],
  ["Change", "تغيير", "Ubah"],
  ["Saving…", "جارٍ الحفظ…", "Menyimpan…"],
  ["Save", "حفظ", "Simpan"],
  [
    "Add {{type}} Address",
    "إضافة عنوان {{type}}",
    "Tambah Alamat {{type}}",
  ],
  [
    "Payment Terms is required.",
    "شروط الدفع مطلوبة.",
    "Syarat pembayaran wajib diisi.",
  ],
  [
    "Each item must have quantity and unit price > 0.",
    "يجب أن يكون لكل بند كمية وسعر وحدة > 0.",
    "Setiap item harus memiliki kuantitas dan harga satuan > 0.",
  ],
  [
    "Each line needs an item name (or select a product) and/or a description.",
    "كل سطر يحتاج اسم بند (أو اختيار منتج) و/أو وصفاً.",
    "Setiap baris memerlukan nama item (atau pilih produk) dan/atau deskripsi.",
  ],
  [
    "A Proforma Invoice already exists for this contract.",
    "توجد فاتورة أولية لهذا العقد بالفعل.",
    "Faktur Proforma untuk kontrak ini sudah ada.",
  ],
  [
    "A Commercial Invoice already exists for this contract.",
    "توجد فاتورة تجارية لهذا العقد بالفعل.",
    "Faktur Komersial untuk kontrak ini sudah ada.",
  ],
  [
    "A Proforma Invoice must be created first.",
    "يجب إنشاء فاتورة أولية أولاً.",
    "Faktur Proforma harus dibuat terlebih dahulu.",
  ],
  [
    "You can upload a maximum of 10 files. Currently have {{count}} file(s).",
    "يمكنك رفع 10 ملفات كحد أقصى. لديك حالياً {{count}} ملف(ات).",
    "Anda dapat mengunggah maksimal 10 file. Saat ini ada {{count}} file.",
  ],
  [
    "The following files exceed 10MB limit: {{files}}",
    "الملفات التالية تتجاوز حد 10 ميجابايت: {{files}}",
    "File berikut melebihi batas 10MB: {{files}}",
  ],
  [
    "{{success}} file(s) uploaded successfully. {{fail}} file(s) failed.",
    "تم رفع {{success}} ملف(ات) بنجاح. فشل {{fail}} ملف(ات).",
    "{{success}} file berhasil diunggah. {{fail}} file gagal.",
  ],
  [
    "{{count}} file(s) uploaded successfully!",
    "تم رفع {{count}} ملف(ات) بنجاح!",
    "{{count}} file berhasil diunggah!",
  ],
  ["Error getting file", "خطأ في جلب الملف", "Gagal mengambil file"],
  ["Terms {{number}}", "الشروط {{number}}", "Ketentuan {{number}}"],
  ["Add new", "إضافة جديد", "Tambah baru"],
  [
    "Add new Terms & Conditions",
    "إضافة شروط وأحكام جديدة",
    "Tambah Syarat & Ketentuan baru",
  ],
  ["Name", "الاسم", "Nama"],
  ["Content", "المحتوى", "Konten"],
  [
    "{{count}} item(s) added successfully",
    "تمت إضافة {{count}} بند(ات) بنجاح",
    "{{count}} item berhasil ditambahkan",
  ],
  [
    "Business is required.",
    "العمل مطلوب.",
    "Bisnis wajib diisi.",
  ],
  [
    "Customer is required.",
    "العميل مطلوب.",
    "Pelanggan wajib diisi.",
  ],
];

/** English strings also used in CreateRecurringInvoice.jsx (auto-copy ar/id from customerInvoices when hash matches) */
const autoCopyStrings = [
  "New recurring invoice",
  "Could not load recurring profile.",
  "Failed to fetch contract details",
  "Failed to load businesses",
  "Failed to load contract details",
  "Failed to upload {{file}}. Please try again.",
  "File removed successfully",
  "Business is required.",
  "Customer is required.",
  "Payment Terms is required.",
  "At least one item is required.",
  "Discount cannot exceed 100%.",
  "Could not validate custom fields.",
  "Invoice number conflict. Retrying with new number...",
  "Insufficient stock:\n{{items}}",
  "Failed to save invoice. Please try again.",
  "Select Invoice Template",
  "View Preview",
  "Select",
  "Cancel",
  "Select Template",
  "Loading preview...",
  "Close",
  "Use This Template",
  "Template not found. Please select a template.",
  "Failed to load template details",
  "Failed to load template content",
  "Invoice Preview",
  "No template content",
  "Preview Error",
  "Error rendering template preview. Please try again.",
  "Business",
  "Select Business",
  "Customer Name",
  "Select Customer",
  "Search customers...",
  "Select a business first",
  "Quick add a new customer",
  "Add",
  "Address Types Not Configured",
  "You do not have any address type yet. Please add address types in Settings first.",
  "Phone",
  "Enter phone number",
  "Fax Number",
  "Enter fax number",
  "Order Number",
  "Enter order number",
  "Currency",
  "Customer currency will appear here",
  "Select customer",
  "Invoice Date",
  "Payment Terms",
  "Select Payment Term",
  "Search payment terms...",
  "Due Date",
  "Salesperson",
  "(optional)",
  "Select Salesperson",
  "Search salespersons...",
  "Configure Now",
  "Profile name",
  "Subject",
  "Will be displayed on the invoice",
  "Customer Notes",
  "Thanks for your business.",
  "Terms & Conditions",
  "Select terms and Conditions",
  "Default",
  "Terms",
  "Terms content (editable after selection)",
  "Contract Information",
  "Calculating contract details...",
  "Contract Total:",
  "Deposit:",
  "Selected Template",
  "View",
  "Selected",
  "Select PDF Template",
  "Commercial Invoice",
  "Proforma Invoice",
  "Success",
  "Failed to save terms.",
  "Saving...",
  "e.g. Standard, Net 30",
  "Enter terms and conditions text...",
];

const manualMap = new Map(manualEntries.map(([en, ar, id]) => [toVisibleKey(en), { en, ar, id }]));
const allEnglish = [
  ...manualEntries.map(([en]) => en),
  ...autoCopyStrings.filter((s) => !manualMap.has(toVisibleKey(s))),
];

const translationDir = path.join(__dirname, "..", "src", "utils", "translation");

for (const lang of ["en", "ar", "id"]) {
  const full = path.join(translationDir, `${lang}.json`);
  const data = JSON.parse(fs.readFileSync(full, "utf8"));
  if (!data.accounts) data.accounts = {};
  if (!data.accounts.recurringInvoices) data.accounts.recurringInvoices = {};
  if (!data.accounts.recurringInvoices.visible) {
    data.accounts.recurringInvoices.visible = {};
  }
  const vis = data.accounts.recurringInvoices.visible;
  const ciVis = data.accounts.customerInvoices?.visible || {};
  let added = 0;

  for (const enText of allEnglish) {
    const key = toVisibleKey(enText);
    if (vis[key] !== undefined) continue;

    if (manualMap.has(key)) {
      const entry = manualMap.get(key);
      vis[key] = entry[lang === "en" ? "en" : lang === "ar" ? "ar" : "id"];
    } else if (lang === "en") {
      vis[key] = enText;
    } else if (ciVis[key]) {
      vis[key] = ciVis[key];
    } else {
      vis[key] = enText;
    }
    added += 1;
  }

  data.accounts.recurringInvoices.visible = vis;
  fs.writeFileSync(full, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`${lang}.json: added ${added} keys (${Object.keys(vis).length} total visible)`);
}
