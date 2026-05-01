export type DemoSocketEvent = {
  type: "token" | "done";
  payload: string;
};

const GATEWAY_KEY_STORAGE = "tria_gateway_api_key";
const GATEWAY_KEY_COOKIE = "tria_gateway_api_key";

function getCookieValue(name: string) {
  if (typeof document === "undefined") {
    return "";
  }

  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matcher = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`));
  return matcher ? decodeURIComponent(matcher[1]) : "";
}

export function getLiveWsUrl() {
  const base = process.env.NEXT_PUBLIC_WS_URL;
  if (!base) {
    return "";
  }

  if (typeof window === "undefined") {
    return base;
  }

  const fromStorage = window.localStorage.getItem(GATEWAY_KEY_STORAGE) ?? "";
  const key = fromStorage || getCookieValue(GATEWAY_KEY_COOKIE);
  if (!fromStorage && key) {
    window.localStorage.setItem(GATEWAY_KEY_STORAGE, key);
  }

  if (!key) {
    return base;
  }

  const url = new URL(base);
  url.searchParams.set("apiKey", key);
  return url.toString();
}

export function createDemoStream(
  message: string,
  onEvent: (event: DemoSocketEvent) => void,
) {
  const response =
    "Recebido. Vou continuar a execução da thread, validar diffs e reportar o próximo checkpoint em seguida.";

  const tokens = response.split(" ");
  let index = 0;

  const timer = setInterval(() => {
    if (index < tokens.length) {
      onEvent({ type: "token", payload: `${tokens[index]} ` });
      index += 1;
      return;
    }

    clearInterval(timer);
    onEvent({ type: "done", payload: message });
  }, 65);

  return () => clearInterval(timer);
}
