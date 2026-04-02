import { useEffect, useRef } from "react";

/**
 * 의존값이 변경될 때 컨테이너 최하단으로 부드럽게 스크롤한다.
 * ref를 하단 sentinel 요소에 부착해서 사용.
 */
export function useAutoScrollBottom(deps: unknown[]) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return bottomRef;
}
