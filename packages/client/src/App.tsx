import { useEffect } from 'react';
import { connect, useClient } from './net/store';
import { Home } from './screens/Home';
import { Lobby } from './screens/Lobby';
import { Game } from './game/Game';

export function App() {
  const client = useClient();
  useEffect(connect, []);

  const { session, room, game } = client;
  let screen: React.ReactNode;
  if (!session) screen = <Home kicked={client.kicked} />;
  else if (!room) screen = <p className="page muted">Verbinde …</p>;
  else if (room.status === 'playing' && game) {
    screen = <Game update={game} room={room} deadline={client.deadline} />;
  } else screen = <Lobby room={room} session={session} />;

  return (
    <>
      {client.connection === 'disconnected' && (
        <p className="banner">Verbindung verloren – verbinde neu …</p>
      )}
      {screen}
    </>
  );
}
