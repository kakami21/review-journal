import {
  launch,
  type BrowserWorker,
} from "@cloudflare/playwright";
import type {
  BrowserProvider,
  BrowserSession,
} from "../reviews/tabelog-review-scraper";

export class CloudflareBrowserProvider implements BrowserProvider {
  constructor(private readonly binding: BrowserWorker) {}

  async open(): Promise<BrowserSession> {
    return launch(this.binding);
  }
}
