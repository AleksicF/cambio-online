/** Socket.IO-Events, die der Server an den Client sendet. */
export interface ServerToClientEvents {
  welcome: (info: { serverVersion: string }) => void;
}

/** Socket.IO-Events, die der Client an den Server sendet. */
export interface ClientToServerEvents {
  ping: (ack: (serverTime: number) => void) => void;
}
