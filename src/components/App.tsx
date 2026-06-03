import React, { useState, useCallback } from "react";
import { Box, Text } from "@claude-code-kit/ink-renderer";
import { REPL, type Message } from "@claude-code-kit/ui";
import { DeepSeekClient, type Message as DSMessage } from "../deepseek.js";

const SYSTEM_PROMPT = `You are a helpful AI coding assistant.

CAPABILITIES
- Read, create, edit, delete files and directories
- Run shell commands (bash, npm, git, python, etc.)
- Search the web for documentation and solutions
- Analyze and explain code
- Debug and fix issues
- Write tests

STYLE
- Be concise and direct
- Provide complete, working code
- Explain your approach briefly before writing code
- Always verify your work

LANGUAGE
- Use the same language as the user
- Code and technical terms stay in English
`;

interface AppProps {
  client: DeepSeekClient;
}

export function App({ client }: AppProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = useCallback(
    async (text: string) => {
      if (isProcessing) return;

      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: text,
      };

      const assistantId = (Date.now() + 1).toString();
      const assistantMessage: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsProcessing(true);

      try {
        let currentMessages: Message[] = [];
        setMessages((prev) => {
          currentMessages = prev;
          return prev;
        });

        const dsMessages: DSMessage[] = [
          { role: "system", content: SYSTEM_PROMPT },
          ...currentMessages
            .filter((m) => m.id !== assistantId)
            .map((m) => ({
              role: m.role as "user" | "assistant",
              content: typeof m.content === "string" ? m.content : "",
            })),
          { role: "user", content: text },
        ];

        let response = "";
        for await (const token of client.chatStream(dsMessages)) {
          response += token;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: response } : m
            )
          );
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `Error: ${errorMessage}` }
              : m
          )
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [client, isProcessing]
  );

  const handleClear = useCallback(() => {
    setMessages([]);
  }, []);

  const commands = [
    {
      name: "clear",
      description: "Clear conversation history",
      onExecute: handleClear,
    },
  ];

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box
        flexDirection="column"
        padding={1}
        borderStyle="round"
        borderColor="cyan"
      >
        <Text bold color="cyan">
          DeepSeek CLI
        </Text>
        <Text color="gray">
          Powered by DeepSeek V3 | Type /clear to reset
        </Text>
      </Box>

      <REPL
        messages={messages}
        onSubmit={handleSubmit}
        commands={commands}
        isLoading={isProcessing}
        placeholder="Ask me anything..."
      />
    </Box>
  );
}
