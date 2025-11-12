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
  },
});

console.log(`Listening on ${server.url}`);
