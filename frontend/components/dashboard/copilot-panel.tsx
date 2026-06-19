"use client"

import { useMemo, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { Bot, BrainCircuit, FileText } from "lucide-react"
import { DefaultChatTransport, isToolUIPart } from "ai"

import type { FloodLensCopilotMessage } from "@/lib/copilot/agent"
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input"
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources"
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion"
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const SUGGESTIONS = [
  "Which districts need attention first?",
  "Why is F104559 risky?",
  "Is retraining needed?",
  "Generate a district action brief for Colombo.",
]

export function CopilotPanel({
  initialPrompt,
  onInitialPromptConsumed,
  onOpenKnowledge,
}: {
  initialPrompt?: string | null
  onInitialPromptConsumed?: () => void
  onOpenKnowledge: () => void
}) {
  const [input, setInput] = useState(initialPrompt ?? "")
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/copilot" }),
    []
  )
  const { messages, sendMessage, status, error } =
    useChat<FloodLensCopilotMessage>({
      transport,
    })
  const isThinking =
    status === "submitted" ||
    (status === "streaming" && messages.at(-1)?.role === "user")

  function submitText(text: string) {
    const clean = text.trim()
    if (!clean) return
    sendMessage({ text: clean })
    setInput("")
    onInitialPromptConsumed?.()
  }

  function handleSubmit(message: PromptInputMessage) {
    submitText(message.text)
  }

  return (
    <div className="w-full">
      <Card className="flex min-h-[calc(100vh-210px)] flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BrainCircuit className="size-4 text-cyan-300" />
            Intelligent Copilot
          </CardTitle>
          <CardDescription>
            Ask about risk, priorities, monitored places, model operations, or
            indexed response documents.
          </CardDescription>
          <CardAction>
            <Button type="button" variant="outline" size="sm" onClick={onOpenKnowledge}>
              <FileText /> Upload knowledge
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col">
          <div className="flex min-h-[620px] flex-1 flex-col">
            <Conversation className="min-h-[460px] flex-1 rounded-lg border border-border bg-muted/10">
              <ConversationContent className="gap-5 p-4">
                {messages.length === 0 ? (
                  <ConversationEmptyState
                    icon={<Bot className="size-10" />}
                    title="Ask an operational question"
                    description="The Copilot calls FloodLens tools before answering risk, priority, monitoring, feedback, or drift questions."
                  />
                ) : (
                  messages.map((message) => (
                    <CopilotMessage key={message.id} message={message} />
                  ))
                )}
                {isThinking ? (
                  <Message from="assistant">
                    <MessageContent>
                      <div
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                        role="status"
                        aria-live="polite"
                      >
                        <Spinner />
                        <span>Thinking...</span>
                      </div>
                    </MessageContent>
                  </Message>
                ) : null}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>

            <div className="mt-3 space-y-3">
              <Suggestions>
                {SUGGESTIONS.map((suggestion) => (
                  <Suggestion
                    key={suggestion}
                    suggestion={suggestion}
                    onClick={submitText}
                    disabled={status !== "ready"}
                  />
                ))}
              </Suggestions>

              <PromptInput onSubmit={handleSubmit}>
                <PromptInputBody>
                  <PromptInputTextarea
                    value={input}
                    onChange={(event) => {
                      setInput(event.currentTarget.value)
                      onInitialPromptConsumed?.()
                    }}
                    placeholder="Ask about risk, priorities, model operations, or uploaded response documents..."
                    className="min-h-20"
                  />
                </PromptInputBody>
                <PromptInputFooter>
                  <div className="text-xs text-muted-foreground">
                    Decision support only. No official alerts or evacuation
                    authority.
                  </div>
                  <PromptInputSubmit
                    status={status}
                    disabled={!input.trim() || status !== "ready"}
                  />
                </PromptInputFooter>
              </PromptInput>

              {error ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  {error.message}
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function CopilotMessage({
  message,
}: {
  message: FloodLensCopilotMessage
}) {
  const toolParts = message.parts.filter(isToolUIPart)
  const documentSources = message.parts.flatMap((part) => {
    if (
      part.type !== "tool-searchDocuments" ||
      part.state !== "output-available"
    ) {
      return []
    }
    return part.output.data.results.map((result) => ({
      href: result.citation_url,
      title: `${result.title}${result.page ? ` · page ${result.page}` : ""}`,
    }))
  })
  const operationalParts = toolParts.filter(
    (part) => getToolName(part) !== "searchDocuments"
  )
  const sourceCount = operationalParts.length + documentSources.length

  return (
    <div className="space-y-2">
      {message.role === "assistant" && sourceCount > 0 ? (
        <Sources>
          <SourcesTrigger count={sourceCount}>
            <span className="font-medium">
              Used {sourceCount} FloodLens source
              {sourceCount === 1 ? "" : "s"}
            </span>
          </SourcesTrigger>
          <SourcesContent>
            {documentSources.map((source) => (
              <Source
                key={`${source.href}-${source.title}`}
                href={source.href}
                title={source.title}
                target="_blank"
                rel="noreferrer"
              />
            ))}
            {operationalParts.map((part) => (
              <Source
                key={part.toolCallId}
                href={toolHref(getToolName(part))}
                title={toolTitle(getToolName(part))}
              />
            ))}
          </SourcesContent>
        </Sources>
      ) : null}

      <Message from={message.role}>
        <MessageContent>
          {message.parts.map((part, index) => {
            if (part.type === "text") {
              return (
                <MessageResponse key={`${message.id}-${index}`}>
                  {part.text}
                </MessageResponse>
              )
            }

            if (isToolUIPart(part)) {
              const toolName = getToolName(part)

              return (
                <Tool key={part.toolCallId} defaultOpen={false}>
                  {part.type === "dynamic-tool" ? (
                    <ToolHeader
                      type={part.type}
                      state={part.state}
                      toolName={toolName}
                      title={toolTitle(toolName)}
                    />
                  ) : (
                    <ToolHeader
                      type={part.type}
                      state={part.state}
                      title={toolTitle(toolName)}
                    />
                  )}
                  <ToolContent>
                    <ToolInput input={part.input} />
                    <ToolOutput
                      output={
                        part.state === "output-available"
                          ? part.output
                          : undefined
                      }
                      errorText={
                        part.state === "output-error"
                          ? part.errorText
                          : undefined
                      }
                    />
                  </ToolContent>
                </Tool>
              )
            }

            return null
          })}
        </MessageContent>
      </Message>
    </div>
  )
}

function getToolName(part: { type: string; toolName?: string }) {
  return part.toolName ?? part.type.replace(/^tool-/, "")
}

function toolTitle(toolName: string) {
  const titles: Record<string, string> = {
    getModelInfo: "Model info",
    getDistrictSummary: "District summary",
    getHighRiskLocations: "High-risk locations",
    getEmergencyPriority: "Emergency priority",
    getLocationRecord: "Location record",
    getModelScores: "Model scores",
    getMonitoringSummary: "Monitoring summary",
    getFeedbackSummary: "Feedback summary",
    getDriftSummary: "Drift summary",
    searchDocuments: "Knowledge search",
  }
  return titles[toolName] ?? toolName
}

function toolHref(toolName: string) {
  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
    "http://127.0.0.1:8000"
  const paths: Record<string, string> = {
    getModelInfo: "/model-info",
    getDistrictSummary: "/district-summary",
    getHighRiskLocations: "/high-risk-locations",
    getEmergencyPriority: "/emergency-priority",
    getLocationRecord: "/locations/{record_id}/record",
    getModelScores: "/model-scores",
    getMonitoringSummary: "/monitoring/summary",
    getFeedbackSummary: "/feedback/summary",
    getDriftSummary: "/monitoring/drift",
  }
  return paths[toolName] ? `${apiBaseUrl}${paths[toolName]}` : "#"
}
