/**
 * Export an element to a downloadable PDF via html2pdf.js.
 *
 * The element must be visible when exportPdf runs — html2pdf uses html2canvas
 * under the hood, which rasterises computed layout. We temporarily add a
 * `data-pdf-exporting` attribute on <html> so a dedicated CSS block can swap
 * colors (black text, red chords, green sections) and reveal `.print-only`
 * containers without going through the browser print dialog.
 */
export async function exportElementToPdf(element: HTMLElement, filename: string) {
  const mod: any = await import('html2pdf.js' as any);
  const html2pdf = mod.default ?? mod;
  const root = document.documentElement;
  root.setAttribute('data-pdf-exporting', '1');
  try {
    await html2pdf()
      .set({
        margin: 10,
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, backgroundColor: '#ffffff', useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] },
      })
      .from(element)
      .save();
  } finally {
    root.removeAttribute('data-pdf-exporting');
  }
}
