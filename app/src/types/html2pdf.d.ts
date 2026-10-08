/**
 * html2pdf.js ships no type definitions. Only the fluent subset we actually
 * use is declared here — extend it if a call site needs more.
 */
declare module 'html2pdf.js' {
  interface Html2PdfOptions {
    margin?: number | [number, number, number, number];
    filename?: string;
    image?: { type?: 'jpeg' | 'png' | 'webp'; quality?: number };
    html2canvas?: Record<string, unknown>;
    jsPDF?: Record<string, unknown>;
    pagebreak?: { mode?: string | string[]; before?: string; after?: string; avoid?: string };
  }

  interface Html2PdfChain {
    set(options: Html2PdfOptions): Html2PdfChain;
    from(element: HTMLElement | string): Html2PdfChain;
    save(): Promise<void>;
    toPdf(): Html2PdfChain;
    outputPdf(type?: string): Promise<unknown>;
  }

  function html2pdf(): Html2PdfChain;
  export default html2pdf;
}
