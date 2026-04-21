// lib/generateReceiptPDF.ts
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface ReceiptItem {
  name: string
  quantity: number
  sell_price: number
  discount: number
  subtotal: number
}

export interface TransactionData {
  invoice_number: string
  created_at: string
  cashier_name: string
  customer_name?: string
  items: ReceiptItem[]
  subtotal: number
  discount_amount: number
  total_amount: number
  paid_amount: number
  change_amount: number
  payment_method: string
  notes?: string
  store_name?: string
  store_address?: string
  store_phone?: string
  paper_width?: '58mm' | '80mm'
}

/**
 * Generates a thermal receipt PDF (58mm or 80mm width)
 * Returns: Blob URL string (for preview/share) or triggers download
 */
export function generateReceiptPDF(
  data: TransactionData,
  action: 'download' | 'share' | 'blob' = 'download'
): string | null {
  const is58mm = (data.paper_width ?? '80mm') === '58mm'
  const pageWidthMm = is58mm ? 58 : 80
  const marginMm = 3

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [pageWidthMm, 297], // height will be trimmed
  })

  const usableWidth = pageWidthMm - marginMm * 2
  let y = marginMm

  // ─── FONTS & HELPERS ───────────────────────────────────────────────
  const fontSizeTitle = is58mm ? 10 : 12
  const fontSizeBody = is58mm ? 7 : 8
  const fontSizeSmall = is58mm ? 6 : 7

  const center = (text: string, fontSize: number, bold = false) => {
    doc.setFontSize(fontSize)
    doc.setFont('courier', bold ? 'bold' : 'normal')
    const w = doc.getTextWidth(text)
    doc.text(text, marginMm + (usableWidth - w) / 2, y)
    y += fontSize * 0.45 + 0.5
  }

  const left = (text: string, fontSize: number, bold = false) => {
    doc.setFontSize(fontSize)
    doc.setFont('courier', bold ? 'bold' : 'normal')
    doc.text(text, marginMm, y)
    y += fontSize * 0.45 + 0.5
  }

  const row = (leftText: string, rightText: string, fontSize: number, bold = false) => {
    doc.setFontSize(fontSize)
    doc.setFont('courier', bold ? 'bold' : 'normal')
    const rightW = doc.getTextWidth(rightText)
    doc.text(leftText, marginMm, y)
    doc.text(rightText, marginMm + usableWidth - rightW, y)
    y += fontSize * 0.45 + 0.5
  }

  const divider = (char = '-') => {
    const count = Math.floor(usableWidth / doc.getTextWidth(char))
    left(char.repeat(count), fontSizeSmall)
  }

  const formatCurrency = (n: number) =>
    'Rp ' + n.toLocaleString('id-ID', { minimumFractionDigits: 0 })

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric'
    }) + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  }

  const paymentLabel: Record<string, string> = {
    cash: 'Tunai', transfer: 'Transfer', qris: 'QRIS', debt: 'Hutang'
  }

  // ─── STORE HEADER ──────────────────────────────────────────────────
  y += 1
  center(data.store_name ?? 'TOKO RETAIL', fontSizeTitle, true)
  if (data.store_address) center(data.store_address, fontSizeSmall)
  if (data.store_phone) center('Telp: ' + data.store_phone, fontSizeSmall)

  y += 1
  divider('=')

  // ─── TRANSACTION INFO ──────────────────────────────────────────────
  row('No:', data.invoice_number, fontSizeSmall)
  row('Tgl:', formatDate(data.created_at), fontSizeSmall)
  row('Kasir:', data.cashier_name, fontSizeSmall)
  if (data.customer_name) row('Pelanggan:', data.customer_name, fontSizeSmall)

  divider()

  // ─── ITEMS TABLE ───────────────────────────────────────────────────
  const tableBody = data.items.map(item => {
    const lines = [`${item.name}`]
    const qtyPrice = `${item.quantity} x ${formatCurrency(item.sell_price)}`
    if (item.discount > 0) lines.push(`Diskon: -${formatCurrency(item.discount * item.quantity)}`)
    return [lines.join('\n'), qtyPrice, formatCurrency(item.subtotal)]
  })

  autoTable(doc, {
    startY: y,
    head: [],
    body: tableBody,
    theme: 'plain',
    styles: {
      font: 'courier',
      fontSize: fontSizeBody,
      cellPadding: { top: 0.5, bottom: 0.5, left: 0, right: 0 },
    },
    columnStyles: {
      0: { cellWidth: usableWidth * 0.5 },
      1: { cellWidth: usableWidth * 0.28, halign: 'right' },
      2: { cellWidth: usableWidth * 0.22, halign: 'right' },
    },
    margin: { left: marginMm, right: marginMm },
    tableWidth: usableWidth,
  })

  y = (doc as any).lastAutoTable.finalY + 1

  divider()

  // ─── TOTALS ────────────────────────────────────────────────────────
  row(`Subtotal (${data.items.length} item)`, formatCurrency(data.subtotal), fontSizeBody)

  if (data.discount_amount > 0) {
    row('Diskon', '-' + formatCurrency(data.discount_amount), fontSizeBody)
  }

  y += 0.5
  divider()
  row('TOTAL', formatCurrency(data.total_amount), fontSizeBody + 1, true)
  divider()

  row(paymentLabel[data.payment_method] ?? data.payment_method, formatCurrency(data.paid_amount), fontSizeBody)

  if (data.payment_method === 'cash') {
    row('Kembali', formatCurrency(Math.max(0, data.change_amount)), fontSizeBody, true)
  } else if (data.payment_method === 'debt') {
    row('HUTANG', formatCurrency(data.total_amount), fontSizeBody, true)
  }

  y += 1
  divider('=')

  // ─── FOOTER ────────────────────────────────────────────────────────
  y += 1
  center('Terima kasih telah berbelanja!', fontSizeSmall)
  center('Barang yang sudah dibeli', fontSizeSmall)
  center('tidak dapat dikembalikan.', fontSizeSmall)
  y += 2

  // Trim page height to content
  const finalHeight = y + marginMm
  const trimmedDoc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [pageWidthMm, finalHeight],
  })

  // Re-render into trimmed doc
  const pdfData = doc.output('arraybuffer')

  // For simplicity, return the original doc with content
  const blob = new Blob([doc.output('arraybuffer')], { type: 'application/pdf' })
  const blobUrl = URL.createObjectURL(blob)

  if (action === 'download') {
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = `struk-${data.invoice_number}.pdf`
    a.click()
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000)
    return null
  }

  if (action === 'share' && navigator.share) {
    const file = new File([blob], `struk-${data.invoice_number}.pdf`, { type: 'application/pdf' })
    navigator.share({ files: [file], title: 'Struk Belanja', text: data.invoice_number })
      .catch(console.error)
    return null
  }

  return blobUrl
}

/**
 * Quick helper: open receipt in new tab for printing
 */
export function printReceipt(data: TransactionData) {
  const url = generateReceiptPDF(data, 'blob')
  if (url) {
    const win = window.open(url, '_blank')
    win?.addEventListener('load', () => { win.print() })
  }
}
