# The match server's image: the simulation, the rooms, co-op survival's director and the locked dependencies.
# Build: docker build -t impact-server .   Run: docker run -p 8080:8080 -e PORT=8080 impact-server
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production

# Runtime dependencies only (tsx, which runs the TypeScript entry point, is one); the page's build and test tools stay out.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY tsconfig.json ./
COPY src/server ./src/server
COPY src/engine/sim ./src/engine/sim
COPY src/game ./src/game
COPY src/survival ./src/survival
# The launch gate (src/originals/launch.ts, which src/server/index.ts imports first) and the voice-cue tables it reads.
COPY src/originals ./src/originals
COPY src/audio/voiceCues.ts src/audio/quipCues.ts src/audio/rosterVoiceCues.ts src/audio/situationVoiceCues.ts ./src/audio/

USER node
ENV PORT=8080
EXPOSE 8080
CMD ["node", "--import", "tsx", "src/server/main.ts"]
