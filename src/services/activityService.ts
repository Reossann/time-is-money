import { invoke } from "@tauri-apps/api/core";

import type { ActiveWindowInfo } from "../types/activity";
import { activeWindowInfoSchema } from "../utils/schemas";

const activeWindowInfoResultSchema = activeWindowInfoSchema.nullable();

/**
 * Tauri Commandから現在の前面ウィンドウ情報を1回分取得する。
 *
 * 前面ウィンドウがない場合はnullを返し、Command失敗と不正なpayloadは
 * 呼び出し元が処理できるようrejectのまま伝える。
 */
export async function getActiveWindowInfo(): Promise<ActiveWindowInfo | null> {
  const result = await invoke<unknown>("get_active_window_info");

  return activeWindowInfoResultSchema.parse(result);
}
