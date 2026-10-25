import { useState } from "react";

/** Astro上のReact連携を確認するため、クリック回数をブラウザ内だけで保持する。 */
export default function DevelopmentCounter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>動作確認：{count} 回</button>;
}
