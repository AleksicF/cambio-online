import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { cardValue, createDeck } from '@cambio/shared';
import { socket } from './socket';

type Status = 'connecting' | 'connected' | 'disconnected';

const previewCards = createDeck().filter((c) => c.kind === 'joker' || c.rank === 'K');

export function App() {
  const [status, setStatus] = useState<Status>('connecting');
  const [serverVersion, setServerVersion] = useState<string | null>(null);

  useEffect(() => {
    const onConnect = () => setStatus('connected');
    const onDisconnect = () => setStatus('disconnected');
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('welcome', ({ serverVersion }) => setServerVersion(serverVersion));
    socket.connect();
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('welcome');
      socket.disconnect();
    };
  }, []);

  return (
    <main className="app">
      <h1>Cambio Online</h1>
      <p className={`status status--${status}`}>
        Server: {status === 'connected' ? `verbunden (v${serverVersion ?? '?'})` : status}
      </p>
      <div className="cards">
        {previewCards.map((card, i) => (
          <motion.div
            key={card.id}
            className="card"
            initial={{ y: -40, opacity: 0, rotate: -10 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            transition={{ delay: i * 0.08, type: 'spring', stiffness: 260, damping: 20 }}
          >
            <span>{card.kind === 'joker' ? 'Joker' : `K ${card.suit}`}</span>
            <strong>{cardValue(card)}</strong>
          </motion.div>
        ))}
      </div>
    </main>
  );
}
