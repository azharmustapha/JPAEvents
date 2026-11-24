# Node.js 24 menyediakan WebSocket natif yang diperlukan Supabase.
FROM node:24-alpine

WORKDIR /app

# Salin senarai pakej dahulu untuk cache layer
COPY package.json package-lock.json* ./
RUN npm ci

# Salin keseluruhan kod projek
COPY . .

# Bina aplikasi Next.js
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_JPAEVENTS_SHARED_PROJECT=false
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_JPAEVENTS_SHARED_PROJECT=$NEXT_PUBLIC_JPAEVENTS_SHARED_PROJECT
RUN test -n "$NEXT_PUBLIC_SUPABASE_URL" && test -n "$NEXT_PUBLIC_SUPABASE_ANON_KEY"
RUN case "$NEXT_PUBLIC_JPAEVENTS_SHARED_PROJECT" in true|false) ;; *) exit 1 ;; esac
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
