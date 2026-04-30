export type DemoSocketEvent = {
  type: "token" | "done";
  payload: string;
};

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
