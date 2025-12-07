interface PdfConversionResult {
  imageUrl: string;
  file: File | null;
  error?: string;
}

async function loadPdfJs() {
  // Dynamically import only in browser
  const pdfjsLib = await import('pdfjs-dist');
  
  // Use the worker from node_modules - Vite will bundle it
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).href;
  
  return pdfjsLib;
}

export async function convertPdfToImage(
  file: File
): Promise<PdfConversionResult> {
  try {
    console.log("Starting PDF conversion...");
    console.log("File:", file.name, file.type, file.size);
    
    const lib = await loadPdfJs();
    console.log("PDF.js loaded successfully");

    const arrayBuffer = await file.arrayBuffer();
    console.log("ArrayBuffer created, size:", arrayBuffer.byteLength);
    
    const pdf = await lib.getDocument({ data: arrayBuffer }).promise;
    console.log("PDF document loaded, pages:", pdf.numPages);
    
    const page = await pdf.getPage(1);
    console.log("First page loaded");

    const viewport = page.getViewport({ scale: 4 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    if (context) {
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
    }

    await page.render({ canvasContext: context!, viewport, canvas }).promise;
    console.log("Page rendered to canvas");

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            console.log("Blob created successfully, size:", blob.size);
            const originalName = file.name.replace(/\.pdf$/i, "");
            const imageFile = new File([blob], `${originalName}.png`, {
              type: "image/png",
            });

            resolve({
              imageUrl: URL.createObjectURL(blob),
              file: imageFile,
            });
          } else {
            console.error("Failed to create blob");
            resolve({
              imageUrl: "",
              file: null,
              error: "Failed to create image blob",
            });
          }
        },
        "image/png",
        1.0
      );
    });
  } catch (err) {
    console.error("PDF conversion error:", err);
    return {
      imageUrl: "",
      file: null,
      error: `Failed to convert PDF: ${err}`,
    };
  }
}