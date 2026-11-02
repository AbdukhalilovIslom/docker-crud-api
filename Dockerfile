# Use an official Node.js runtime as the base image.
FROM node:22-alpine

# Set the working directory inside the container.
WORKDIR /app

# Copy dependency manifests first to take advantage of Docker layer caching.
COPY package*.json ./
RUN npm install

# Copy the TypeScript source and compiler configuration.
COPY tsconfig.json main.ts ./

# Compile TypeScript into JavaScript.
RUN npm run build

# The API listens on port 3000 by default.
EXPOSE 3000

# Start the compiled application.
CMD ["npm", "start"]
