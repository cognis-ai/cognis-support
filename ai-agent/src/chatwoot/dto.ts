import { z } from 'zod';

// Chatwoot agent-bot webhook payload — ported from
// cognis-platform/apps/bridge/src/features/agent-bot/dto.ts
// See app/listeners/agent_bot_listener.rb in chatwoot/chatwoot. We only act on
// `message_created`. Schema is permissive (Chatwoot evolves it); we keep the fields we use.

const ChatwootSenderSchema = z
  .object({
    id: z.number().optional(),
    name: z.string().optional(),
    email: z.string().optional(),
    type: z.string().optional(),
  })
  .passthrough();

const ChatwootMessageSchema = z
  .object({
    id: z.number(),
    content: z.string().nullable().optional(),
    message_type: z.union([z.number(), z.string()]).optional(),
    created_at: z.union([z.number(), z.string()]).optional(),
    private: z.boolean().optional(),
    sender: ChatwootSenderSchema.optional(),
  })
  .passthrough();

const ChatwootConversationSchema = z
  .object({
    id: z.number(),
    messages: z.array(ChatwootMessageSchema).optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const ChatwootWebhookSchema = z
  .object({
    event: z.string(),
    id: z.number().optional(),
    content: z.string().nullable().optional(),
    message_type: z.union([z.number(), z.string()]).optional(),
    private: z.boolean().optional(),
    conversation: ChatwootConversationSchema.optional(),
    account: z.object({ id: z.number(), name: z.string().optional() }).passthrough().optional(),
    sender: ChatwootSenderSchema.optional(),
  })
  .passthrough();

export type ChatwootWebhook = z.infer<typeof ChatwootWebhookSchema>;

// Chatwoot message_type semantics: 0 / "incoming" = from customer, 1 / "outgoing" = agent/bot
export function isIncomingFromCustomer(
  messageType: number | string | undefined,
  isPrivate: boolean | undefined,
): boolean {
  if (isPrivate === true) return false;
  if (messageType === undefined) return false;
  return messageType === 0 || messageType === 'incoming';
}
