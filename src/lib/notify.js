const MESSAGES = {
  return: {
    title: 'Hora de voltar do almoço',
    message: 'Seu 1h de almoço acabou. Bata o ponto de volta.',
  },
  out: {
    title: '8h completas',
    message: 'Você já pode bater o ponto de saída.',
  },
};

export function shouldNotify(target, notifiedFor, nowMs) {
  if (!target) return false;
  if (nowMs < target.atMs) return false;
  return notifiedFor !== target.atMs;
}

export function notificationFor(kind) {
  return MESSAGES[kind] ?? null;
}
