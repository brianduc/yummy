FROM oven/bun:1.1-alpine
WORKDIR /app
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile
COPY . .
EXPOSE 3100
ENV MCP_TRANSPORT=sse
ENV PORT=3100
CMD ["bun", "run", "src/server.ts"]
