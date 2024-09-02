import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello , the deploy works!");
});

export default app;
