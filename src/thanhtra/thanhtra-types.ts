export type ThanhtraDoc = {
  id: number;
  title: string;
  description: string;
  fileRef: string;
  pdfUrl: string | null;
  localPath: string | null;
  fileSize: number;
  modifiedAt: string;
  createdAt: string;
};

export type ThanhtraRawItem = {
  ID?: number;
  Title?: string;
  FileRef?: string;
  CanvasContent1?: string;
  Description?: string;
  Modified?: string;
  Created?: string;
};

export type ThanhtraSyncResult = {
  totalScanned: number;
  newDownloaded: number;
  updated: number;
  errors: number;
  items: Array<{
    title: string;
    pdfUrl: string | null;
    localPath: string | null;
    downloaded: boolean;
  }>;
};
