import { createAgentUIStreamResponse, type UIMessage } from "ai"

import { floodLensCopilotAgent } from "@/lib/copilot/agent"

export const maxDuration = 30

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      {
        error:
          "OPENAI_API_KEY is not configured. Add it to frontend/.env.local to use FloodLens Intelligent Copilot.",
      },
      { status: 503 }
    )
  }

  const { messages }: { messages: UIMessage[] } = await request.json()

  return createAgentUIStreamResponse({
    agent: floodLensCopilotAgent,
    uiMessages: messages,
    timeout: { totalMs: 30_000 },
  })
}
