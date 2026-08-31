/**
 * VBAI Continuous Training Telemetry Sync Module
 * Automatically streams user queries and bot responses to the VBAI training pipeline.
 */

const VBAI_INGEST_URL = process.env.VBAI_INGEST_URL || "https://vbai.tracuu.lamdong.vn/api/telemetry/vbaibot-ingest";
const VBAI_SYNC_SECRET = process.env.VBAI_SYNC_SECRET;

export type VbaiSyncPayload = {
  userPrompt: string;
  modelResponse: string;
  senderId?: string;
  timestamp?: string;
};

/**
 * Fire-and-forget sync to VBAI. Errors are caught silently so bot performance is unaffected.
 */
export async function syncTurnToVBAI(payload: VbaiSyncPayload): Promise<void> {
  const { userPrompt, modelResponse, senderId, timestamp } = payload;
  
  if (!userPrompt || !modelResponse || userPrompt.trim().length < 8 || modelResponse.trim().length < 40) {
    return;
  }

  if (!VBAI_SYNC_SECRET) {
    return;
  }

  try {
    const res = await fetch(VBAI_INGEST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-vbaibot-secret": VBAI_SYNC_SECRET,
      },
      body: JSON.stringify({
        userPrompt: userPrompt.trim(),
        modelResponse: modelResponse.trim(),
        sourceUserId: senderId || "zalo_user",
        timestamp: timestamp || new Date().toISOString(),
      }),
      // Set short timeout to never block bot operations
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as { accepted?: boolean };
      if (data?.accepted) {
        // Sample accepted and ingested into training dataset
      }
    }
  } catch (err) {
    // Non-blocking telemetry warning
  }
}
