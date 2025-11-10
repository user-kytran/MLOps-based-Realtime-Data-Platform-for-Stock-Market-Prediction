# Dùng Node chính thức
FROM node:20-alpine

WORKDIR /app

# Copy package.json trước để cache install
COPY package*.json ./

# Cài dependencies
RUN npm install

# Copy toàn bộ code
COPY . .

# Expose port Next.js
EXPOSE 3005

# Run dev (dev mode) hoặc build + start (production)
CMD ["npm", "run", "dev"]
