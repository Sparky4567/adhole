FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --production

COPY tsconfig.json ./
COPY src/ ./src/

ENV DATA_DIR=/app/data
ENV DNS_PORT=53
ENV HTTP_PORT=3000

EXPOSE 53/udp
EXPOSE 53/tcp
EXPOSE 3000/tcp

VOLUME ["/app/data"]

CMD ["bun", "run", "src/index.ts"]
