// Хранилище SSE подключений
const sseConnections = new Map<number, Set<ReadableStreamDefaultController>>();

const server = Bun.serve({
  port: 5000,
  websocket: {
    data: {} as {
      id: number;
      name: string;
    },
    open(ws) {
      ws.subscribe(`broadcast:${ws.data.id}`);
    },
    close(ws, code, reason) {
      console.log(`WebSocket connection closed: ${code} - ${reason}`);
    },
    message(ws, message) {
      ws.publish(`broadcast:${ws.data.id}`, `Echo: ${message}`);
    },
  },
  routes: {
    "/": () => new Response(Bun.file(`${import.meta.dir}/assets/index.html`)),
    "/ws-client": () => new Response(Bun.file(`${import.meta.dir}/assets/client.html`)),
    "/ws-sender": () => new Response(Bun.file(`${import.meta.dir}/assets/sender.html`)),
    "/sse-client": () => new Response(Bun.file(`${import.meta.dir}/assets/sse-client.html`)),
    "/sse-sender": () => new Response(Bun.file(`${import.meta.dir}/assets/sse-sender.html`)),
    "/broadcast/:id/:name": (req, server) => {
      server.upgrade(req, {
        data: { id: Number(req.params.id), name: req.params.name },
      });
    },
    "/send-event/:id": (req) => {
      const id = Number(req.params.id);
      const message = `Hello to WebSocket ID ${id}`;
      server.publish(`broadcast:${id}`, message, true);
      return new Response(`Sent message to WebSocket ID ${id}`);
    },
    "/sse/:id": (req) => {
      const id = Number(req.params.id);
      
      const stream = new ReadableStream({
        start(controller) {
          // Добавляем контроллер в хранилище
          if (!sseConnections.has(id)) {
            sseConnections.set(id, new Set());
          }
          sseConnections.get(id)!.add(controller);
          
          // Отправляем начальное сообщение
          controller.enqueue(`data: Connected to SSE stream (ID: ${id})\n\n`);
          
          // Пинг каждые 30 секунд для поддержания соединения
          const interval = setInterval(() => {
            try {
              controller.enqueue(`:ping\n\n`);
            } catch {
              clearInterval(interval);
            }
          }, 30000);
          
          // Очистка при закрытии
          req.signal.addEventListener('abort', () => {
            clearInterval(interval);
            const controllers = sseConnections.get(id);
            if (controllers) {
              controllers.delete(controller);
              if (controllers.size === 0) {
                sseConnections.delete(id);
              }
            }
            try {
              controller.close();
            } catch {}
          });
        }
      });
      
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    },
    "/sse-send/:id": async (req) => {
      const id = Number(req.params.id);
      const message = `Hello to SSE ID ${id} at ${new Date().toLocaleTimeString()}`;
      
      const controllers = sseConnections.get(id);
      if (!controllers || controllers.size === 0) {
        return new Response(`No SSE connections found for ID ${id}`, { status: 404 });
      }
      
      let sent = 0;
      controllers.forEach(controller => {
        try {
          controller.enqueue(`data: ${message}\n\n`);
          sent++;
        } catch (error) {
          console.error('Failed to send SSE message:', error);
        }
      });
      
      return new Response(`Sent message to ${sent} SSE connection(s) with ID ${id}`);
    },
  },
});

console.log(`Listening on ${server.url}`);
