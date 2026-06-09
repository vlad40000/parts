# Multi-stage build for Next.js app with Python backend extraction support
FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:18-alpine AS builder
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
RUN npm prune --production

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install Python 3 and system pip
RUN apk add --no-cache python3 py3-pip

# Set up a virtual environment to avoid PEP 668 and break-system-packages issues
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Upgrade pip and install required python packages
RUN pip install --no-cache-dir --upgrade pip setuptools && \
    pip install --no-cache-dir google-genai openpyxl

COPY --from=builder /app ./

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["npm", "run", "start"]

