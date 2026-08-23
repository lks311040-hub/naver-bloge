import { detectPublishedPosts } from "./detectPublished.js";

/**
 * "발행 대기" 글이 블로그에 올라갔는지 주기적으로 확인해서 주소를 기록한다.
 *
 * 초안 화면에도 같은 일을 하는 버튼이 있지만, 버튼만 있으면 원래 문제가 그대로
 * 남는다 — 예약 발행을 걸어두고 며칠 뒤 발행되고 나면, 대시보드로 돌아와 버튼을
 * 누를 이유를 잊는다. 그래서 앱이 켜져 있는 동안은 알아서 확인한다.
 *
 * 조용히 도는 게 원칙이다: 로그인 전이거나 네트워크가 끊겼거나 블로그가
 * 응답하지 않아도 서버는 아무 영향 없이 계속 돌아야 하므로, 실패는 로그 한 줄로
 * 끝내고 다음 주기를 기다린다. 성공해도 기록한 게 있을 때만 로그를 남긴다.
 */

const INTERVAL_MS = 60 * 60 * 1000; // 1시간
/** 부팅 직후는 조금 기다린다 — 마이그레이션/기동 로그와 겹치지 않게. */
const FIRST_RUN_DELAY_MS = 30 * 1000;

async function runOnce(): Promise<void> {
  try {
    const { matched } = await detectPublishedPosts();
    if (matched.length) {
      console.log(`[publish-watcher] ${matched.length}건을 발행 완료로 기록했습니다:`);
      for (const m of matched) console.log(`  - ${m.title} -> ${m.publishedUrl}`);
    }
  } catch (err) {
    // 로그인 전이면 매 시간 이 메시지가 찍힌다. 시끄럽지만 "왜 기록이 안 되지"를
    // 추적할 때 바로 보이는 편이 낫다.
    console.warn(`[publish-watcher] 확인 실패 (다음 주기에 다시 시도): ${err instanceof Error ? err.message : err}`);
  }
}

export function startPublishWatcher(): void {
  const first = setTimeout(runOnce, FIRST_RUN_DELAY_MS);
  const timer = setInterval(runOnce, INTERVAL_MS);
  // 서버가 이것 때문에 종료를 못 하는 일이 없게 한다.
  first.unref();
  timer.unref();
  console.log("[publish-watcher] started (1시간마다 블로그 발행 여부 확인)");
}
