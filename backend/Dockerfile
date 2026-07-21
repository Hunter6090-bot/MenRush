FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

# Profile/message media. Production MUST mount a Railway volume at /app/uploads —
# without it, every redeploy wipes photos and the map falls back to generic avatars.
RUN mkdir -p /app/uploads

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
