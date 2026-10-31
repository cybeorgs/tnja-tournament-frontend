"use client";

/** Read a file as a data: URL. Images are shrunk to at most `maxSide` px and re-encoded as JPEG to keep uploads small. */
export async function fileToDataUrl(file: File, { maxSide = 800, maxPdfBytes = 1024 * 1024 } = {}): Promise<string> {
  if (file.type === "application/pdf") {
    if (file.size > maxPdfBytes) throw new Error("PDF must be smaller than 1 MB.");
    return readAsDataUrl(file);
  }
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) throw new Error("Choose a JPG, PNG or WEBP image.");

  const source = await readAsDataUrl(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("That image could not be read."));
    el.src = source;
  });
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; // transparent PNGs would otherwise turn black as JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("The file could not be read."));
    reader.readAsDataURL(file);
  });
}
