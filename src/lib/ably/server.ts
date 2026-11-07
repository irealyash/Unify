import Ably from "ably";

export function getAblyRest() {
  const key = process.env.ABLY_API_KEY;
  if (!key) {
    throw new Error("ABLY_API_KEY is not set");
  }
  return new Ably.Rest(key);
}

export function userChannelName(userId: string) {
  return `user:${userId}`;
}

export function conversationChannelName(conversationId: string) {
  return `conversation:${conversationId}`;
}

export async function publishToUser(userId: string, name: string, data: unknown) {
  try {
    const ably = getAblyRest();
    const channel = ably.channels.get(userChannelName(userId));
    await channel.publish(name, data);
  } catch (error) {
    console.error("Ably publish failed (user channel)", error);
  }
}

export async function publishToConversation(
  conversationId: string,
  name: string,
  data: unknown,
) {
  try {
    const ably = getAblyRest();
    const channel = ably.channels.get(conversationChannelName(conversationId));
    await channel.publish(name, data);
  } catch (error) {
    console.error("Ably publish failed (conversation channel)", error);
  }
}

export async function createAblyTokenRequest(
  clientId: string,
  capability: Record<string, string[]>,
) {
  const ably = getAblyRest();
  return ably.auth.createTokenRequest({
    clientId,
    // Ably capability ops are a closed string union; channel map is built server-side.
    capability: capability as unknown as { [key: string]: ["subscribe", "presence"] },
    ttl: 60 * 60 * 1000,
  });
}
