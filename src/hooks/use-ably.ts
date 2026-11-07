"use client";

import * as Ably from "ably";
import { useEffect, useRef, useState } from "react";
import { clientApi } from "@/lib/client-api";

export function useAblyChannel(
  channelName: string | null,
  onMessage?: (event: string, data: unknown) => void,
) {
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!channelName) return;

    let channel: Ably.RealtimeChannel | null = null;

    const client = new Ably.Realtime({
      authCallback: async (_tokenParams, callback) => {
        try {
          const { tokenRequest } = await clientApi<{ tokenRequest: Ably.TokenRequest }>(
            "/api/ably/token",
          );
          callback(null, tokenRequest);
        } catch (err) {
          callback(err as Ably.ErrorInfo, null);
        }
      },
    });

    client.connection.on("connected", () => setConnected(true));
    client.connection.on("disconnected", () => setConnected(false));

    channel = client.channels.get(channelName);
    channel.subscribe((msg) => {
      onMessageRef.current?.(msg.name ?? "message", msg.data);
    });

    return () => {
      channel?.unsubscribe();
      client.close();
      setConnected(false);
    };
  }, [channelName]);

  return { connected };
}

export function useAblyUserChannel(
  userId: string | null,
  onEvent: (event: string, data: unknown) => void,
) {
  return useAblyChannel(userId ? `user:${userId}` : null, onEvent);
}
