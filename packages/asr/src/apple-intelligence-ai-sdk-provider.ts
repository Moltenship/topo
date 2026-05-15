import type { LanguageModel } from "ai";

type AppleIntelligenceLanguageModel = Extract<
  LanguageModel,
  { readonly specificationVersion: "v3" }
>;

export interface AppleIntelligenceBridgeRequest {
  readonly modelId: string;
  readonly prompt: string;
  readonly systemPrompt?: string;
  readonly abortSignal?: AbortSignal;
}

export interface AppleIntelligenceBridge {
  readonly generate: (request: AppleIntelligenceBridgeRequest) => Promise<string>;
}

export const appleIntelligence = (
  modelId: string,
  bridge: AppleIntelligenceBridge = unavailableAppleIntelligenceBridge,
): AppleIntelligenceLanguageModel => ({
  specificationVersion: "v3",
  provider: "topo.apple-intelligence",
  modelId,
  supportedUrls: {},
  doGenerate: async ({ abortSignal, prompt }) => {
    const textPrompt = promptToText(prompt);
    const text = await bridge.generate({
      modelId,
      prompt: textPrompt.prompt,
      ...(textPrompt.systemPrompt ? { systemPrompt: textPrompt.systemPrompt } : {}),
      ...(abortSignal ? { abortSignal } : {}),
    });

    return {
      content: [{ type: "text", text }],
      finishReason: { unified: "stop", raw: "stop" },
      usage: {
        inputTokens: {
          total: undefined,
          noCache: undefined,
          cacheRead: undefined,
          cacheWrite: undefined,
        },
        outputTokens: { total: undefined, text: undefined, reasoning: undefined },
      },
      warnings: [],
      response: {
        timestamp: new Date(),
        modelId,
      },
    };
  },
  doStream: async () => {
    throw new Error("Apple Intelligence streaming is not supported.");
  },
});

const unavailableAppleIntelligenceBridge: AppleIntelligenceBridge = {
  generate: async () => {
    throw new Error("Apple Intelligence bridge is not configured.");
  },
};

const promptToText = (
  prompt: Parameters<AppleIntelligenceLanguageModel["doGenerate"]>[0]["prompt"],
): { readonly systemPrompt?: string; readonly prompt: string } => {
  const systemPrompt = prompt
    .flatMap((message) => (message.role === "system" ? [message.content] : []))
    .join("\n");
  const userPrompt = prompt
    .flatMap((message) =>
      message.role === "system"
        ? []
        : message.content.flatMap((part) => (part.type === "text" ? [part.text] : [])),
    )
    .join("\n");

  return {
    ...(systemPrompt ? { systemPrompt } : {}),
    prompt: userPrompt || systemPrompt,
  };
};
