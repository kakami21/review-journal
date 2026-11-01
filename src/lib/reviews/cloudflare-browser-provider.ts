import {
  launch,
  type BrowserWorker,
} from "@cloudflare/playwright";
import type {
  BrowserProvider,
  BrowserSession,
} from "./scraping-browser";

/** Cloudflareの接続だけを担当し、食べログの巡回・抽出は収集側へ委ねる。 */
export class CloudflareBrowserProvider implements BrowserProvider {
  constructor(private readonly binding: BrowserWorker) {}

  async open(): Promise<BrowserSession> {
    return launch(this.binding);
  }
}
