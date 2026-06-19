"use client"

import { useMemo, useState } from "react"
import type { ReactNode } from "react"
import { useChat } from "@ai-sdk/react"
import {
  Bot,
  BrainCircuit,
  DatabaseZap,
  FileText,
  ShieldAlert,
} from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
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

export function CopilotPanel() {
  const [input, setInput] = useState("")
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/copilot" }),
    []
  )
  const { messages, sendMessage, status, error } =
    useChat<FloodLensCopilotMessage>({
      transport,
    })

  function submitText(text: string) {
    const clean = text.trim()
    if (!clean) return
    sendMessage({ text: clean })
    setInput("")
  }

  function handleSubmit(message: PromptInputMessage) {
    submitText(message.text)
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <Card className="min-h-[720px]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BrainCircuit className="size-4 text-cyan-300" />
            Intelligent Copilot
          </CardTitle>
          <CardDescription>
            GPT-powered operations assistant grounded in FloodLens model,
            monitoring, feedback, drift, and priority data.
          </CardDescription>
          <CardAction>
            <Badge variant="outline" className="font-mono">
              OpenAI / {process.env.NEXT_PUBLIC_OPENAI_MODEL_LABEL ?? "GPT"}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="flex h-[610px] flex-col">
            <Conversation className="rounded-lg border border-border bg-muted/10">
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
                    onChange={(event) => setInput(event.currentTarget.value)}
                    placeholder="Ask about district risk, a record ID, priority queues, monitoring, feedback, or retraining..."
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

      <Card>
        <CardHeader>
          <CardTitle>Grounding Contract</CardTitle>
          <CardDescription>
            What the Copilot is allowed to use and what it must refuse.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <InfoItem
            icon={<DatabaseZap />}
            title="Uses FloodLens tools"
            detail="District summaries, priority queues, model scores, monitoring, feedback, and drift."
          />
          <InfoItem
            icon={<FileText />}
            title="RAG-ready, not RAG yet"
            detail="Document upload, embeddings, and pgvector come after this tool-grounded layer is stable."
          />
          <InfoItem
            icon={<ShieldAlert />}
            title="Decision support only"
            detail="No invented live weather, verified disaster status, official warnings, or evacuation orders."
          />
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

  return (
    <div className="space-y-2">
      {message.role === "assistant" && toolParts.length > 0 ? (
        <Sources>
          <SourcesTrigger count={toolParts.length}>
            <span className="font-medium">
              Used {toolParts.length} FloodLens source
              {toolParts.length === 1 ? "" : "s"}
            </span>
          </SourcesTrigger>
          <SourcesContent>
            {toolParts.map((part) => (
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

function InfoItem({
  icon,
  title,
  detail,
}: {
  icon: ReactNode
  title: string
  detail: string
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-2 font-medium">
        <span className="text-cyan-300 [&_svg]:size-4">{icon}</span>
        {title}
      </div>
      <p className="mt-1 text-muted-foreground">{detail}</p>
    </div>
  )
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
  }
  return titles[toolName] ?? toolName
}

function toolHref(toolName: string) {
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
  return paths[toolName] ?? "#"
}
