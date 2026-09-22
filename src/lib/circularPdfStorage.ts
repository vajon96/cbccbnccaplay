import { 
  db, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  writeBatch, 
  Timestamp 
} from "../firebase";
import { getSafePdfUrl } from "./pdfUtils";

/**
 * Firestore documents have a strict 1,048,576 byte (1 MiB) ceiling.
 * Binary PDFs converted to Base64 expand by ~33%, so a 750KB+ file can exceed 1MB.
 * We split large base64 PDF payloads into 350,000 character segments stored
 * in a subcollection: /circulars/{circularId}/chunks/{chunkId}.
 */
const CHUNK_SIZE = 350000;

// In-memory cache to prevent re-downloading chunked PDFs during the active session
const memoryPdfCache = new Map<string, string>();

/**
 * Splits a base64 string into chunk documents in the circular's subcollection.
 */
export async function saveCircularPdfChunks(circularId: string, base64Data: string): Promise<number> {
  if (!circularId || !base64Data) return 0;

  const chunks: string[] = [];
  for (let i = 0; i < base64Data.length; i += CHUNK_SIZE) {
    chunks.push(base64Data.slice(i, i + CHUNK_SIZE));
  }

  // Use writeBatch for atomic and rapid insertion
  const batch = writeBatch(db);
  chunks.forEach((chunk, index) => {
    const chunkRef = doc(db, "circulars", circularId, "chunks", `chunk_${index.toString().padStart(4, "0")}`);
    batch.set(chunkRef, {
      chunkIndex: index,
      data: chunk,
      createdAt: Timestamp.now()
    });
  });

  await batch.commit();

  // Populate session cache immediately
  memoryPdfCache.set(circularId, base64Data);

  return chunks.length;
}

/**
 * Loads a circular's PDF data, reassembling chunks if needed.
 */
export async function loadCircularPdf(circular: {
  id?: string;
  pdfData?: string;
  hasPdfChunks?: boolean;
}): Promise<string> {
  if (!circular) return "";

  // 1. Check in-memory cache
  if (circular.id && memoryPdfCache.has(circular.id)) {
    return memoryPdfCache.get(circular.id)!;
  }

  // 2. Check legacy inline pdfData on main document
  if (circular.pdfData && typeof circular.pdfData === "string" && circular.pdfData.length > 50) {
    if (circular.id) {
      memoryPdfCache.set(circular.id, circular.pdfData);
    }
    return circular.pdfData;
  }

  // 3. Load from chunks subcollection
  if (!circular.id) return "";

  try {
    const chunksSnap = await getDocs(collection(db, "circulars", circular.id, "chunks"));
    if (chunksSnap.empty) {
      return circular.pdfData || "";
    }

    const chunkItems: { chunkIndex: number; data: string }[] = [];
    chunksSnap.forEach((d) => {
      const data = d.data();
      chunkItems.push({
        chunkIndex: typeof data.chunkIndex === "number" ? data.chunkIndex : 0,
        data: typeof data.data === "string" ? data.data : ""
      });
    });

    chunkItems.sort((a, b) => a.chunkIndex - b.chunkIndex);
    const assembledBase64 = chunkItems.map((c) => c.data).join("");

    if (assembledBase64) {
      memoryPdfCache.set(circular.id, assembledBase64);
    }

    return assembledBase64;
  } catch (error) {
    console.error("Failed to load PDF chunks for circular:", circular.id, error);
    return circular.pdfData || "";
  }
}

/**
 * Deletes all chunks associated with a circular to avoid orphaned data.
 */
export async function deleteCircularPdfChunks(circularId: string): Promise<void> {
  if (!circularId) return;
  memoryPdfCache.delete(circularId);

  try {
    const chunksSnap = await getDocs(collection(db, "circulars", circularId, "chunks"));
    if (chunksSnap.empty) return;

    const batch = writeBatch(db);
    chunksSnap.forEach((d) => {
      batch.delete(d.ref);
    });
    await batch.commit();
  } catch (error) {
    console.warn("Could not delete PDF chunks for circular:", circularId, error);
  }
}

/**
 * Downloads a circular PDF directly to the user's device.
 */
export async function downloadCircularPdf(circular: any, fallbackName?: string): Promise<void> {
  const base64Data = await loadCircularPdf(circular);
  if (!base64Data) {
    throw new Error("PDF data not available for this circular");
  }

  const safeUrl = getSafePdfUrl(base64Data);
  const link = document.createElement("a");
  link.href = safeUrl;
  const fileName = `BNCC_Circular_${circular?.referenceNumber || fallbackName || "Official"}.pdf`;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
