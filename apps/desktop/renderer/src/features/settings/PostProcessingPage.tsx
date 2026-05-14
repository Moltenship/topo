import { useMemo, useState } from "react";
import {
  DEFAULT_APP_SETTINGS,
  type ApiPostProcessingProvider,
  type AppSettings,
  type Platform,
  type PostProcessingMode,
} from "@topo/shared";
import { BrainCircuit, KeyRound, Server, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SettingsRow, SettingsSection, SettingsSelect } from "@/components/settings-layout";
import { cn } from "@/lib/utils";

interface PostProcessingPageProps {
  readonly platform: Platform;
  readonly settings: AppSettings | null;
  readonly onSettingsChange: (settings: AppSettings) => void;
}

const defaultCleanupPrompt =
  "Clean this transcript while preserving the speaker's meaning. Fix casing, punctuation, filler artifacts, and obvious transcription spacing. Return only the cleaned transcript.";

const modeOptions = [
  {
    value: "lightweight",
    label: "Lightweight",
    description:
      "Fast local cleanup for timestamps, whitespace, punctuation, and common blank audio hallucinations.",
    icon: WandSparkles,
  },
  {
    value: "apple-intelligence",
    label: "Apple Intelligence",
    description: "On-device language cleanup through the local macOS bridge when available.",
    icon: BrainCircuit,
  },
  {
    value: "api",
    label: "API provider",
    description: "Use an OpenAI-compatible provider for stronger transcript rewriting.",
    icon: Server,
  },
  {
    value: "raw",
    label: "Raw",
    description: "Insert the transcript exactly as the local speech runtime returns it.",
    icon: KeyRound,
  },
] satisfies readonly {
  readonly value: PostProcessingMode;
  readonly label: string;
  readonly description: string;
  readonly icon: typeof WandSparkles;
}[];

const apiProviderOptions = [
  { label: "OpenAI", value: "openai" },
  { label: "OpenRouter", value: "openrouter" },
  { label: "Custom", value: "custom-openai-compatible" },
] satisfies readonly { readonly label: string; readonly value: ApiPostProcessingProvider }[];

const defaultApiModels: Record<ApiPostProcessingProvider, string> = {
  openai: "gpt-5.4-mini",
  openrouter: "openai/gpt-5.4-mini",
  "custom-openai-compatible": "local-model",
};

const providerDescriptions: Record<ApiPostProcessingProvider, string> = {
  openai: "Uses OpenAI chat models through the shared AI SDK provider path.",
  openrouter: "Uses OpenRouter with the same OpenAI-compatible request shape.",
  "custom-openai-compatible": "Targets a custom OpenAI-compatible base URL.",
};

const getApiSettings = (settings: AppSettings | null) =>
  settings?.postProcessingApiProvider ?? {
    providerId: "openai",
    modelId: defaultApiModels.openai,
    baseUrl: null,
    apiKeyStorageKey: null,
  };

const getAppleIntelligenceStatus = (platform: Platform): string => {
  if (platform === "macos") {
    return "Readiness is checked by the local macOS bridge before use.";
  }

  return "Unavailable on this platform. Apple Intelligence cleanup requires a supported macOS device.";
};

export const PostProcessingPage = ({
  platform,
  settings,
  onSettingsChange,
}: PostProcessingPageProps) => {
  const apiSettings = getApiSettings(settings);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [promptDraft, setPromptDraft] = useState(defaultCleanupPrompt);
  const [connectionState, setConnectionState] = useState<"idle" | "ready" | "missing-key">("idle");
  const appleIntelligenceUnavailable = platform !== "macos";
  const mode = settings?.postProcessingMode ?? DEFAULT_APP_SETTINGS.postProcessingMode;
  const apiKeySummary = apiKeyDraft.length > 0 ? "Key staged for secure storage" : "No key staged";
  const selectedProviderDescription = providerDescriptions[apiSettings.providerId];

  const fetchedModelOptions = useMemo(
    () => [
      { label: apiSettings.modelId, value: apiSettings.modelId },
      {
        label: defaultApiModels[apiSettings.providerId],
        value: defaultApiModels[apiSettings.providerId],
      },
    ],
    [apiSettings.modelId, apiSettings.providerId],
  );

  const updateSettings = (next: Partial<AppSettings>) => {
    if (settings) {
      onSettingsChange({ ...settings, ...next });
    }
  };

  const updateApiSettings = (next: Partial<typeof apiSettings>) => {
    if (!settings) {
      return;
    }

    const providerId = next.providerId ?? apiSettings.providerId;
    const modelId =
      next.modelId ??
      (providerId === apiSettings.providerId ? apiSettings.modelId : defaultApiModels[providerId]);

    onSettingsChange({
      ...settings,
      postProcessingMode: "api",
      postProcessingApiProvider: {
        ...apiSettings,
        ...next,
        providerId,
        modelId,
      },
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <SettingsSection id="post-processing-mode" title="Post-processing">
        <div className="grid grid-cols-2 gap-2 border-t border-border/60 px-4 py-4 first:border-t-0 max-sm:grid-cols-1 sm:px-5">
          {modeOptions.map((option) => {
            const Icon = option.icon;
            const disabled = option.value === "apple-intelligence" && appleIntelligenceUnavailable;
            const active = mode === option.value;

            return (
              <button
                className={cn(
                  "min-h-[112px] rounded-lg border bg-background/60 p-3 text-left outline-none transition-colors hover:bg-secondary/40 focus-visible:border-primary/70 disabled:pointer-events-none disabled:opacity-50",
                  active && "border-primary/50 bg-primary/10",
                )}
                disabled={!settings || disabled}
                key={option.value}
                type="button"
                onClick={() => updateSettings({ postProcessingMode: option.value })}
              >
                <div className="flex items-center gap-2">
                  <Icon className="size-4 text-muted-foreground" />
                  <span className="text-[13px] font-semibold text-foreground">{option.label}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground/80">
                  {disabled ? getAppleIntelligenceStatus(platform) : option.description}
                </p>
              </button>
            );
          })}
        </div>
        <SettingsRow title="Apple Intelligence" description={getAppleIntelligenceStatus(platform)}>
          <span className="rounded-md border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            {platform === "macos" ? "Bridge required" : "Unavailable"}
          </span>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection id="api-provider" title="API Provider">
        <SettingsRow title="Provider" description={selectedProviderDescription}>
          <SettingsSelect
            disabled={!settings}
            value={apiSettings.providerId}
            options={apiProviderOptions}
            onChange={(providerId) => updateApiSettings({ providerId })}
          />
        </SettingsRow>
        <SettingsRow
          title="API key"
          description="Keys are staged here for secure main-process storage; they are not written into settings."
        >
          <div className="flex min-w-[320px] items-center justify-end gap-2 max-sm:min-w-0 max-sm:flex-wrap max-sm:justify-start">
            <Input
              aria-label="API key"
              className="w-[210px]"
              disabled={!settings}
              placeholder="sk-..."
              type="password"
              value={apiKeyDraft}
              onChange={(event) => {
                setApiKeyDraft(event.target.value);
                setConnectionState("idle");
              }}
            />
            <Button
              disabled={!settings}
              size="sm"
              variant="outline"
              type="button"
              onClick={() => setConnectionState(apiKeyDraft.trim() ? "ready" : "missing-key")}
            >
              Test
            </Button>
          </div>
        </SettingsRow>
        <SettingsRow
          title="Key status"
          description={
            connectionState === "ready"
              ? "Connection test is ready for provider-specific IPC wiring."
              : connectionState === "missing-key"
                ? "Enter an API key before testing this provider."
                : apiKeySummary
          }
        >
          <span className="rounded-md border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            {connectionState === "ready"
              ? "Ready"
              : connectionState === "missing-key"
                ? "Missing key"
                : "Not tested"}
          </span>
        </SettingsRow>
        <SettingsRow
          title="Model"
          description="Choose the model identifier sent to the selected OpenAI-compatible provider."
        >
          <div className="flex min-w-[320px] items-center justify-end gap-2 max-sm:min-w-0 max-sm:flex-wrap max-sm:justify-start">
            <Input
              aria-label="Post-processing model"
              className="w-[210px]"
              disabled={!settings}
              value={apiSettings.modelId}
              onChange={(event) => updateApiSettings({ modelId: event.target.value })}
            />
            <Button
              disabled={!settings}
              size="sm"
              variant="outline"
              type="button"
              onClick={() =>
                updateApiSettings({ modelId: fetchedModelOptions[0]?.value ?? apiSettings.modelId })
              }
            >
              Fetch
            </Button>
          </div>
        </SettingsRow>
        <SettingsRow
          title="Base URL"
          description="Only required for custom OpenAI-compatible providers."
        >
          <Input
            aria-label="Custom provider base URL"
            className="w-[320px] max-sm:w-full"
            disabled={!settings || apiSettings.providerId !== "custom-openai-compatible"}
            placeholder="https://api.example.com/v1"
            value={apiSettings.baseUrl ?? ""}
            onChange={(event) => updateApiSettings({ baseUrl: event.target.value || null })}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection id="cleanup-prompt" title="Prompt">
        <div className="border-t border-border/60 px-4 py-4 first:border-t-0 sm:px-5">
          <Textarea
            aria-label="Default cleanup prompt"
            className="min-h-[132px]"
            disabled={!settings}
            value={promptDraft}
            onChange={(event) => setPromptDraft(event.target.value)}
          />
          <div className="mt-3 flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-start">
            <p className="text-xs leading-relaxed text-muted-foreground/80">
              Prompt editing is local to this tab until prompt persistence is wired into provider
              settings.
            </p>
            <Button
              disabled={!settings || promptDraft === defaultCleanupPrompt}
              size="sm"
              variant="outline"
              type="button"
              onClick={() => setPromptDraft(defaultCleanupPrompt)}
            >
              Reset
            </Button>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
};
